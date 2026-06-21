# 🐉 3X-UI Glass

> A customized 3X-UI panel with Glassmorphism UI, IP Limit enforcement, and enhanced management tools.

## ✨ Features

- 🎨 **4 Themes**: Light, Dark, Ultra-Dark, Ultra-Black (Glassmorphism)
- 🔒 **IP Limit Enforcement**: Auto-disconnect clients exceeding device limit via UUID swap
- 📋 **Export Links**: Select multiple configs and export subscription + vless links
- ⚠️ **Violation Badge**: Visual warning in panel for IP limit violations
- 🐉 **Dragon Menu**: Colorful ASCII art management menu
- ℹ️ **Panel Info**: Quick view of panel URL, port, and path
- ⚡ **BBR Support**: One-click BBR congestion control
- 📱 **Mobile Responsive**: Optimized for mobile devices
- 🔍 **Expandable Inbounds**: View clients directly under each inbound

## 📦 Installation

```bash
wget https://github.com/alir3zai/3x-ui-glass/releases/download/v4.2/3x-ui-glass-amd64.tar.gz
tar xzf 3x-ui-glass-amd64.tar.gz
cd 3x-ui-glass
bash install.sh
```

**Default credentials:** `admin` / `admin` — Change immediately after install!

## ⚙️ Management

```bash
x-ui    # Open management menu
```

| Option | Action |
|--------|--------|
| 1 | Reset Username \& Password |
| 2 | Reset Web Base Path |
| 3 | Reset Port |
| 6 | Panel Info (URL, Port, Path) |
| 7-9 | Start / Stop / Restart |
| 15 | SSL Certificate (Let's Encrypt) |
| 16 | **Enable IP Limit Enforcement** |
| 17 | Disable IP Limit Enforcement |
| 18 | Enable BBR |

## 🔒 IP Limit Enforcement Setup

After installation:

1. Open panel → **Panel Settings → Security → API Tokens** → Create token
2. Run on server:
```bash
echo 'API_TOKEN=your_token_here' > /usr/local/x-ui/ip_limiter.conf
```
3. Run `x-ui` → Option **16** (Enable IP Limit Enforcement)

### ⚠️ Troubleshooting IP Limit

**Problem: `Log file not found`**
```bash
touch /var/log/x-ui/access.log
systemctl restart ip-limiter
```

**Problem: `Failed to fetch clients: HTTP Error 404`**
```bash
# Check panel URL
x-ui → option 6 (Panel Info)

# Update conf with correct BASE_URL
echo 'BASE_URL=http://127.0.0.1:PORT' > /usr/local/x-ui/ip_limiter.conf
echo 'API_TOKEN=your_token' >> /usr/local/x-ui/ip_limiter.conf
systemctl restart ip-limiter
```

**Problem: Access log not enabled after option 16**
```bash
# Manually enable in panel:
# Xray Configs → Basics → Log → Access Log → ./access.log → Save → Restart Xray
# Then:
touch /var/log/x-ui/access.log
systemctl restart ip-limiter
```

**Check IP Limiter logs:**
```bash
tail -f /var/log/x-ui/ip_limiter.log
```

---

## 🇮🇷 راهنمای فارسی

### نصب
```bash
wget https://github.com/alir3zai/3x-ui-glass/releases/download/v4.2/3x-ui-glass-amd64.tar.gz
tar xzf 3x-ui-glass-amd64.tar.gz
cd 3x-ui-glass
bash install.sh
```

### راه‌اندازی IP Limit
1. وارد پنل شوید → **Panel Settings → Security → API Tokens** → توکن جدید بسازید
2. روی سرور اجرا کنید:
```bash
echo 'API_TOKEN=توکن_شما' > /usr/local/x-ui/ip_limiter.conf
```
3. دستور `x-ui` را اجرا کنید و گزینه **16** را انتخاب کنید

### عیب‌یابی IP Limit

**مشکل: فایل لاگ پیدا نشد**
```bash
touch /var/log/x-ui/access.log
systemctl restart ip-limiter
```

**مشکل: خطای ۴۰۴ در اتصال به API**
```bash
# پورت و مسیر پنل را چک کنید
x-ui → گزینه 6

# فایل conf را آپدیت کنید
nano /usr/local/x-ui/ip_limiter.conf
```

**مشکل: Access log فعال نشد بعد از گزینه ۱۶**
```bash
# از داخل پنل فعال کنید:
# Xray Configs → Basics → Log → Access Log → ./access.log → Save → Restart Xray
touch /var/log/x-ui/access.log
systemctl restart ip-limiter
```

**مشاهده لاگ‌های سیستم:**
```bash
tail -f /var/log/x-ui/ip_limiter.log
```

## 📋 Changelog

### v4.5.2
- 🐛 **Fix**: Hysteria/Hysteria2 per-user traffic stats now correctly tracked — counters `user>>>email>>>traffic>>>uplink/downlink` were always zero due to an upstream xray-core bug where `CounterConnection` blocked the `User()` type assertion in the hysteria proxy. Fixed by calling `TryUnwrapStatsConn` before the assertion. Patched xray binary included in release assets.

### v4.5.1
- ✨ Enhanced glassmorphism UI across all themes
- 🐛 Fix cross-page client selection
- 🐛 Fix export links URL fragment handling

### v4.5.0
- 🔒 IP Limit Enforcement via UUID swap
- ⚠️ IP violation badge in panel
- 📋 Bulk export subscription + vless links
- 🐉 Dragon menu for server management

## 📄 License
Based on [3X-UI](https://github.com/MHSanaei/3x-ui) by MHSanaei
