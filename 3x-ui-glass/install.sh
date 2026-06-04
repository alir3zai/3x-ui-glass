#!/bin/bash
# Version: v3.1
# Release: https://github.com/alir3zai/3x-ui-glass/releases/tag/v3.1
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
PLAIN='\033[0m'

INSTALL_DIR="/usr/local/x-ui"
BIN_DIR="/usr/local/bin"
SERVICE_FILE="/etc/systemd/system/x-ui.service"

info()    { echo -e "${CYAN}[INFO]${PLAIN}  $*"; }
success() { echo -e "${GREEN}[OK]${PLAIN}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${PLAIN}  $*"; }
die()     { echo -e "${RED}[ERROR]${PLAIN} $*" >&2; exit 1; }

check_root() {
    [[ $EUID -eq 0 ]] || die "This script must be run as root: sudo bash install.sh"
}

detect_os() {
    [[ -f /etc/os-release ]] || die "Cannot detect OS: /etc/os-release not found."
    . /etc/os-release
    OS_ID="${ID}"
    OS_LIKE="${ID_LIKE:-}"

    case "$OS_ID" in
        ubuntu|debian)
            PKG_INSTALL="apt-get install -y"
            PKG_UPDATE="apt-get update -qq"
            ;;
        centos|rhel|almalinux|rocky)
            PKG_INSTALL="yum install -y"
            PKG_UPDATE="yum makecache -q"
            ;;
        fedora)
            PKG_INSTALL="dnf install -y"
            PKG_UPDATE="dnf makecache -q"
            ;;
        *)
            if echo "$OS_LIKE" | grep -qiE "debian|ubuntu"; then
                PKG_INSTALL="apt-get install -y"
                PKG_UPDATE="apt-get update -qq"
            elif echo "$OS_LIKE" | grep -qiE "rhel|fedora"; then
                PKG_INSTALL="yum install -y"
                PKG_UPDATE="yum makecache -q"
            else
                die "Unsupported OS: $OS_ID"
            fi
            ;;
    esac
    success "OS detected: ${PRETTY_NAME:-$OS_ID}"
}

get_arch() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64|amd64)   XRAY_ARCH="64" ;;
        aarch64|arm64)  XRAY_ARCH="arm64-v8a" ;;
        armv7*)         XRAY_ARCH="arm32-v7a" ;;
        *)              die "Unsupported architecture: $arch" ;;
    esac
    success "Architecture: $arch"
}

get_server_ip() {
    SERVER_IP=$(curl -s4 --connect-timeout 5 ifconfig.me 2>/dev/null \
        || curl -s4 --connect-timeout 5 icanhazip.com 2>/dev/null \
        || hostname -I 2>/dev/null | awk '{print $1}' \
        || echo "YOUR_SERVER_IP")
}

install_deps() {
    info "Installing dependencies..."
    $PKG_UPDATE >/dev/null 2>&1 || true
    $PKG_INSTALL curl wget tar unzip ca-certificates >/dev/null 2>&1 || true
    success "Dependencies ready."
}

install_binary() {
    info "Installing x-ui binary..."
    mkdir -p "${INSTALL_DIR}/bin"

    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    [[ -f "${script_dir}/x-ui" ]] || die "x-ui binary not found next to install.sh"

    cp -f "${script_dir}/x-ui" "${INSTALL_DIR}/x-ui"
    chmod +x "${INSTALL_DIR}/x-ui"
    success "x-ui binary installed to ${INSTALL_DIR}/x-ui"
}

install_manage() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [[ -f "${script_dir}/x-ui-manage" ]]; then
        cp -f "${script_dir}/x-ui-manage" "${BIN_DIR}/x-ui-manage"
        chmod +x "${BIN_DIR}/x-ui-manage"
        ln -sf "${BIN_DIR}/x-ui-manage" "${BIN_DIR}/x-ui"
        success "x-ui-manage installed. Run 'x-ui' to open the management menu."
    else
        ln -sf "${INSTALL_DIR}/x-ui" "${BIN_DIR}/x-ui"
        warn "x-ui-manage not found in package; falling back to direct binary symlink."
    fi
}

install_ip_limiter() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [[ -f "${script_dir}/ip_limiter.py" ]]; then
        cp -f "${script_dir}/ip_limiter.py" "${INSTALL_DIR}/ip_limiter.py"
        chmod +x "${INSTALL_DIR}/ip_limiter.py"
        success "ip_limiter.py installed. Run 'x-ui' → option 15 to enable IP Limit Enforcement."
    else
        warn "ip_limiter.py not found in package; skipping."
    fi
}

download_xray() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    info "Installing xray-core from package..."
    [[ -f "${script_dir}/xray" ]] || die "xray binary not found in package."
    cp -f "${script_dir}/xray" "${INSTALL_DIR}/bin/xray-linux-amd64"
    chmod +x "${INSTALL_DIR}/bin/xray-linux-amd64"
    success "xray-core installed."

    info "Installing geo data files from package..."
    [[ -f "${script_dir}/geoip.dat" ]]   || die "geoip.dat not found in package."
    [[ -f "${script_dir}/geosite.dat" ]] || die "geosite.dat not found in package."
    cp -f "${script_dir}/geoip.dat"   "${INSTALL_DIR}/bin/geoip.dat"
    cp -f "${script_dir}/geosite.dat" "${INSTALL_DIR}/bin/geosite.dat"
    success "Geo data files installed."
}

create_service() {
    info "Creating systemd service..."
    cat > "${SERVICE_FILE}" <<'EOF'
[Unit]
Description=3X-UI Panel Service
After=network.target nss-lookup.target

[Service]
Type=simple
WorkingDirectory=/usr/local/x-ui/
ExecStart=/usr/local/x-ui/x-ui
Restart=on-failure
RestartSec=5s
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable x-ui >/dev/null 2>&1
    success "systemd service created and enabled."
}

start_service() {
    info "Starting x-ui..."
    systemctl start x-ui
    sleep 3
    if systemctl is-active --quiet x-ui; then
        success "x-ui is running."
    else
        warn "x-ui did not start. Check logs: journalctl -u x-ui -n 30"
    fi
}

get_panel_info() {
    PANEL_PORT=$("${INSTALL_DIR}/x-ui" setting -show 2>/dev/null \
        | grep -oP '(?<=port: )\d+' | head -1)
    PANEL_PATH=$("${INSTALL_DIR}/x-ui" setting -show 2>/dev/null \
        | grep -oP '(?<=webBasePath: )\S+' | head -1)
    PANEL_PORT="${PANEL_PORT:-2053}"
    PANEL_PATH="${PANEL_PATH:-/panel}"
    [[ "$PANEL_PATH" == /* ]] || PANEL_PATH="/${PANEL_PATH}"
}

show_result() {
    get_server_ip
    get_panel_info
    echo ""
    echo -e "╔═══════════════════════════════════════════════════╗"
    echo -e "║   ${GREEN}${BOLD}✅  Installation successful!${PLAIN}                   ║"
    echo -e "╠═══════════════════════════════════════════════════╣"
    printf  "║  %-51s║\n" "Panel URL:"
    printf  "║  %-51s║\n" "  http://${SERVER_IP}:${PANEL_PORT}${PANEL_PATH}"
    echo -e "╠═══════════════════════════════════════════════════╣"
    printf  "║  %-51s║\n" "Default username : admin"
    printf  "║  %-51s║\n" "Default password : admin"
    echo -e "╠═══════════════════════════════════════════════════╣"
    printf  "║  %-51s║\n" "Management command: x-ui"
    echo -e "╚═══════════════════════════════════════════════════╝"
    echo ""
    echo -e "${YELLOW}⚠️  Change the default credentials immediately!${PLAIN}"
    echo -e "   Run ${CYAN}x-ui${PLAIN} and choose option 1."
    echo ""
}

main() {
    echo ""
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${PLAIN}"
    echo -e "${BOLD}         3X-UI Panel — Installer v1.0${PLAIN}"
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${PLAIN}"
    echo ""

    check_root
    detect_os
    get_arch
    install_deps
    install_binary
    install_manage
    install_ip_limiter
    download_xray
    create_service
    start_service
    show_result
}

main "$@"
