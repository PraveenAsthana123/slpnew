# Configuration Guide — SLP Systems Portal

---

## Table of Contents

- [Environment Variables](#environment-variables)
- [Backend Configuration](#backend-configuration)
- [Frontend Configuration](#frontend-configuration)
- [SMTP Setup (SendGrid)](#smtp-setup-sendgrid)
- [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
- [Nginx Configuration](#nginx-configuration)
- [Feature Flags](#feature-flags)
- [Admin Config Panel](#admin-config-panel)
- [Production Security Checklist](#production-security-checklist)

---

## Environment Variables

### Backend (.NET)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ConnectionStrings__DefaultConnection` | No | `Data Source=slpsystems.db` | Database connection string |
| `AllowedOrigins__0` | Yes | `http://localhost:3000` | CORS allowed origin (frontend URL) |
| `RateLimit__MaxRequests` | No | `100` | Max requests per window per IP |
| `RateLimit__WindowSeconds` | No | `60` | Rate limit window duration |
| `ASPNETCORE_ENVIRONMENT` | No | `Development` | `Development` or `Production` |
| `ASPNETCORE_URLS` | No | `http://+:5062` | Listen URL and port |

### Frontend (Next.js)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:5062` | Backend API URL (browser-accessible) |
| `NEXT_PUBLIC_SITE_URL` | No | `https://slpsystems.ca` | Canonical site URL for OG meta tags |
| `PORT` | No | `3000` | Next.js server port |

### Docker / Deployment

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEPLOY_HOST` | CI/CD | — | Production server hostname |
| `DEPLOY_USER` | CI/CD | — | SSH username for deployment |
| `DEPLOY_SSH_KEY` | CI/CD | — | SSH private key (GitHub Secret) |
| `DEPLOY_PORT` | CI/CD | `22` | SSH port |

---

## Backend Configuration

### appsettings.json Structure

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      { "Name": "Console" },
      {
        "Name": "File",
        "Args": {
          "path": "logs/slpsystems-.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 30
        }
      }
    ]
  },
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=slpsystems.db"
  },
  "AllowedOrigins": [
    "http://localhost:3000",
    "http://localhost:3001"
  ],
  "RateLimit": {
    "MaxRequests": 100,
    "WindowSeconds": 60
  }
}
```

### Key Configuration Sections

| Section | Purpose |
|---------|---------|
| `Serilog` | Structured logging to console + rolling file (30 days retention) |
| `ConnectionStrings` | SQLite database path |
| `AllowedOrigins` | CORS whitelist (add your production domain here) |
| `RateLimit` | Per-IP request throttling |

### Adding a New Allowed Origin

Edit `appsettings.json`:
```json
"AllowedOrigins": [
  "http://localhost:3000",
  "https://yourdomain.com",
  "https://your-tunnel-url.trycloudflare.com"
]
```

---

## Frontend Configuration

### .env.local

```bash
# Required — points browser to the .NET backend
NEXT_PUBLIC_API_URL=http://localhost:5062

# Optional — for OG meta tags / canonical URLs
NEXT_PUBLIC_SITE_URL=https://slpsystems.ca
```

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // Required for Docker deployment
};
module.exports = nextConfig;
```

> **Important**: `output: 'standalone'` must be set for Docker builds. The Dockerfile copies `.next/standalone` as the production server.

---

## SMTP Setup (SendGrid)

### Step 1: Create a SendGrid Account

1. Go to [sendgrid.com](https://sendgrid.com) and sign up (free tier: 100 emails/day)
2. Verify your sender email under Settings → Sender Authentication

### Step 2: Create an API Key

1. Go to Settings → API Keys → Create API Key
2. Name: `SLP Systems Portal`
3. Permissions: Full Access (or restricted to Mail Send)
4. Copy the key (starts with `SG.`)

### Step 3: Configure in Admin Panel

Go to **Admin → Settings** and set:

| Field | Value |
|-------|-------|
| SMTP Host | `smtp.sendgrid.net` |
| SMTP Port | `587` |
| SMTP Username | `apikey` (literally the word "apikey") |
| SMTP Password | `SG.your_api_key_here` |

### Step 4: Test

Go to **Admin → Config → Email/SMTP** and use the "Send Test" button.

### Alternative: Environment Variables

For Docker/production, set via environment:

```bash
# In .env or docker-compose.yml
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=SG.your_key_here
```

---

## Cloudflare Tunnel Setup

Share your local development environment with anyone on the internet without port forwarding.

### Prerequisites

```bash
# Install cloudflared
# Ubuntu/Debian
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

### Quick Tunnels (No Account Needed)

```bash
# Terminal 1: Frontend tunnel
cloudflared tunnel --url http://localhost:3000
# Output: https://random-words.trycloudflare.com

# Terminal 2: Backend tunnel
cloudflared tunnel --url http://localhost:5062
# Output: https://other-random-words.trycloudflare.com
```

### After Starting Tunnels

1. **Update frontend** `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=https://other-random-words.trycloudflare.com
   ```

2. **Update backend** `appsettings.json` CORS:
   ```json
   "AllowedOrigins": [
     "http://localhost:3000",
     "https://random-words.trycloudflare.com"
   ]
   ```

3. **Restart both** frontend and backend

4. **Share** the frontend tunnel URL

> **Note**: Quick tunnel URLs change each time. For permanent URLs, create a free Cloudflare account and use named tunnels.

---

## Nginx Configuration

### Configuration File: `nginx/nginx.conf`

### Rate Limiting Zones

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=general:10m rate=50r/s;
```

| Zone | Rate | Purpose |
|------|------|---------|
| `api` | 20 req/s | API endpoints (`/api/`) |
| `general` | 50 req/s | Frontend pages |

### Routing Rules

| Path | Destination | Special Handling |
|------|-------------|------------------|
| `/api/*` | Backend (port 5062) | Rate limited (api zone) |
| `/hubs/*` | Backend (port 5062) | **WebSocket upgrade** for SignalR |
| `/*` | Frontend (port 3000) | General rate limit |

### WebSocket Upgrade (SignalR)

```nginx
location /hubs/ {
    proxy_pass http://backend:5062;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

> **Critical**: Without the WebSocket upgrade headers, SignalR live chat will not work.

### SSL Configuration

The Nginx config includes a commented-out HTTPS server block. To enable:

1. Place certificates: `nginx/ssl/fullchain.pem` and `nginx/ssl/privkey.pem`
2. Uncomment the HTTPS server block
3. Replace `yourdomain.com` with your actual domain
4. Restart Nginx: `docker compose restart nginx`

---

## Feature Flags

### Backend Feature Flags (Database)

Stored in `SiteSettings` table, managed via Admin → Settings:

| Flag | Default | Effect |
|------|---------|--------|
| `NewsletterEnabled` | false | Shows/hides newsletter signup form on homepage and blog |

### Frontend Feature Flags (localStorage)

Managed via Admin → Config → Feature Flags:

| Flag | Key | Default | Effect |
|------|-----|---------|--------|
| Careers Page | `flag_careersPage` | true | Shows/hides /careers and nav link |
| Live Chat Widget | `flag_liveChat` | true | Shows/hides floating chat button |
| Blog Section | `flag_blogEnabled` | true | Shows/hides blog pages and nav |

> **Note**: Frontend flags are stored in the admin's browser localStorage. They're useful for quick A/B testing or maintenance mode but don't persist across browsers.

---

## Admin Config Panel

The Config Panel at `/admin/config` provides a central hub for managing:

### Social Media Tab
- Edit Facebook, Twitter/X, LinkedIn, Instagram profile URLs
- Auto-generates UTM campaign tracking URLs for each platform:
  ```
  https://facebook.com/yourpage?utm_source=facebook&utm_medium=social&utm_campaign=slpsystems
  ```
- One-click copy for campaign URLs

### Email/SMTP Tab
- View current SMTP configuration (read-only)
- Send test email to verify SMTP works
- SendGrid quick-setup guide

### Feature Flags Tab
- Toggle backend features (Newsletter) — saved to database
- Toggle frontend features (Careers, Chat, Blog) — saved to localStorage

### API & Integrations Tab
- Live backend health check status (green/red indicator)
- Integration status for:
  - SendGrid (SMTP)
  - Cloudflare Tunnel
  - SignalR (Live Chat)
  - SQLite Database
  - GitHub Actions CI/CD
- Required environment variables for each integration

---

## Production Security Checklist

### Must Do Before Going Live

- [ ] **Change admin password** — Default is `Admin@123456`
- [ ] **Set `ASPNETCORE_ENVIRONMENT=Production`** — Disables Swagger, enables HTTPS redirect
- [ ] **Configure CORS** — Remove `localhost` origins, add only your production domain
- [ ] **Enable HTTPS** — Configure SSL certificates in Nginx
- [ ] **Set secure cookie policy** — Cookies should be `Secure; HttpOnly; SameSite=Strict`
- [ ] **Review rate limits** — Adjust `MaxRequests` based on expected traffic
- [ ] **Enable SMTP** — Configure SendGrid for contact form notifications
- [ ] **Remove default seed data** — Or customize with real company information
- [ ] **Set up backups** — Schedule `cp slpsystems.db backup-$(date +%Y%m%d).db`
- [ ] **Enable log rotation** — Serilog already configured for 30-day retention
- [ ] **Review `.gitignore`** — Ensure `.env`, `*.db`, `*.key` are excluded
- [ ] **Set `NEXT_PUBLIC_SITE_URL`** — For correct OG meta tags and canonical URLs

### Security Headers (Auto-Applied)

The `SecurityHeadersMiddleware` automatically adds to every response:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

---

*Last updated: 2026-03-05*
