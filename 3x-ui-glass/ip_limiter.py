#!/usr/bin/env python3
import re
import time
import threading
import logging
import subprocess
import urllib.request
import urllib.parse
import json as _json
from datetime import datetime, timedelta
from collections import defaultdict

CONF_FILE = "/usr/local/x-ui/ip_limiter.conf"
LOG_FILE = "/var/log/x-ui/access.log"
CHECK_INTERVAL = 30
WINDOW_SECONDS = 300
DISABLE_DURATION = 600  # 10 minutes


def _get_xui_url() -> str | None:
    """Build BASE_URL by querying x-ui binary for current port and basePath."""
    try:
        result = subprocess.run(
            ["/usr/local/x-ui/x-ui", "setting", "-show"],
            capture_output=True, text=True, timeout=5,
        )
        output = result.stdout + result.stderr
        port_m = re.search(r"port\s*[:=]\s*(\d+)", output, re.IGNORECASE)
        path_m = re.search(r"webBasePath\s*[:=]\s*(\S+)", output, re.IGNORECASE)
        if port_m:
            port = port_m.group(1)
            path = path_m.group(1) if path_m else ""
            if path and not path.startswith("/"):
                path = "/" + path
            return f"http://127.0.0.1:{port}{path}".rstrip("/")
    except Exception:
        pass
    return None


def _load_conf() -> tuple[str, str]:
    """Build BASE_URL from x-ui binary; read only API_TOKEN from CONF_FILE.
    Falls back to BASE_URL in conf if the x-ui binary is unavailable."""
    base_url = "http://127.0.0.1:2053"
    api_token = ""

    xui_url = _get_xui_url()
    if xui_url:
        base_url = xui_url

    try:
        with open(CONF_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("BASE_URL=") and xui_url is None:
                    base_url = line.split("=", 1)[1].strip()
                elif line.startswith("API_TOKEN="):
                    api_token = line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass

    return base_url, api_token


BASE_URL, API_TOKEN = _load_conf()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("/var/log/x-ui/ip_limiter.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# 2026/06/03 01:14:07.587241 from tcp:151.232.17.125:0 accepted ... email: Keyvan-1
LOG_RE = re.compile(
    r"^(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})\.\d+"
    r" from (\S+?):\d+ accepted .+ email: (\S+)"
)

# email -> full client dict (stored at disable time so re-enable uses same payload)
disabled_clients: dict[str, dict] = {}
disabled_lock = threading.Lock()


def _api(method: str, path: str, body: dict | None = None) -> dict:
    data = _json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {API_TOKEN}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return _json.loads(resp.read().decode("utf-8"))


def _build_payload(client: dict, enabled: bool) -> dict:
    # Copy the full original object so uuid, subId, password, auth, etc. are
    # preserved exactly as returned by the API — only flip the enable flag.
    payload = dict(client)
    payload["enable"] = enabled
    return payload


def parse_log() -> dict[str, set[str]]:
    cutoff = datetime.now() - timedelta(seconds=WINDOW_SECONDS)
    email_ips: dict[str, set[str]] = defaultdict(set)
    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                m = LOG_RE.match(line.rstrip())
                if not m:
                    continue
                ts_str, ip, email = m.group(1), m.group(2), m.group(3).strip()
                ip = ip.replace("tcp:", "").replace("udp:", "")
                if ip in ("127.0.0.1", "::1"):
                    continue
                try:
                    ts = datetime.strptime(ts_str, "%Y/%m/%d %H:%M:%S")
                except ValueError:
                    continue
                if ts >= cutoff:
                    email_ips[email].add(ip)
    except FileNotFoundError:
        logger.warning("Log file not found: %s", LOG_FILE)
    return email_ips


def get_clients() -> dict[str, dict]:
    """Return {email: full_client_dict} for clients with limitIp > 0."""
    try:
        data = _api("GET", "/panel/api/clients/list")
        raw = data if isinstance(data, list) else data.get("obj", data.get("data", []))
        result: dict[str, dict] = {}
        for c in raw:
            email = c.get("email") or c.get("Email", "")
            limit = int(c.get("limitIp") or c.get("limit_ip") or c.get("LimitIP") or 0)
            if email and limit > 0:  # 0 = unlimited
                result[email] = c
        return result
    except Exception as e:
        logger.error("Failed to fetch clients: %s", e)
        return {}


def _set_enabled(client: dict, enabled: bool) -> bool:
    email = client.get("email", "")
    email_enc = urllib.parse.quote(email.encode("utf-8"), safe="")
    payload = _build_payload(client, enabled)
    try:
        _api("POST", f"/panel/api/clients/update/{email_enc}", payload)
        return True
    except Exception as e:
        action = "enable" if enabled else "disable"
        logger.error("Failed to %s %s: %s", action, email, e)
        return False


def enable_client(email: str, client: dict) -> None:
    if _set_enabled(client, True):
        logger.info("[RESTORE] %s re-enabled after %ds", email, DISABLE_DURATION)
    with disabled_lock:
        disabled_clients.pop(email, None)


def disable_client(client: dict, ip_count: int, limit: int, ips: set[str]) -> None:
    email = client.get("email", "")
    if _set_enabled(client, False):
        logger.info(
            "[DISABLE] %s: %d unique IPs in last 5m (limit=%d) IPs=%s — disabled for %ds",
            email, ip_count, limit, sorted(ips), DISABLE_DURATION,
        )
        t = threading.Timer(DISABLE_DURATION, enable_client, args=[email, client])
        t.daemon = True
        t.start()
    else:
        # API call failed — remove from tracking so next cycle retries
        with disabled_lock:
            disabled_clients.pop(email, None)


def check_and_enforce() -> None:
    email_ips = parse_log()
    clients = get_clients()
    if not clients:
        return

    with disabled_lock:
        already_disabled = set(disabled_clients)

    for email, client in clients.items():
        if email in already_disabled:
            continue

        ips = email_ips.get(email, set())
        limit = int(client.get("limitIp") or client.get("limit_ip") or 0)
        if len(ips) <= limit:
            continue

        with disabled_lock:
            if email in disabled_clients:
                continue
            disabled_clients[email] = client

        disable_client(client, len(ips), limit, ips)


def flush_iptables() -> None:
    try:
        subprocess.run(["iptables", "-F", "INPUT"], check=True, capture_output=True)
        logger.info("Flushed INPUT chain — old iptables rules cleared")
    except Exception as e:
        logger.warning("Could not flush iptables INPUT: %s", e)


def main() -> None:
    flush_iptables()
    logger.info(
        "ip_limiter started — interval=%ds  window=%ds  disable_duration=%ds",
        CHECK_INTERVAL, WINDOW_SECONDS, DISABLE_DURATION,
    )
    while True:
        try:
            check_and_enforce()
        except Exception as e:
            logger.error("Unexpected error: %s", e)
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
