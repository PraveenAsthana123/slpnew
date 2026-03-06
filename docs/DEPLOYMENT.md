# Deployment Guide — SLP Systems Portal

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Compose Deployment](#docker-compose-deployment)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [SSL/HTTPS Setup](#sslhttps-setup)
- [Cloudflare Setup](#cloudflare-setup)
- [VPS Requirements](#vps-requirements)
- [Health Check Verification](#health-check-verification)
- [Rollback Procedure](#rollback-procedure)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Development

| Tool | Version | Purpose |
|------|---------|---------|
| .NET SDK | 8.0+ | Backend build and run |
| Node.js | 20+ | Frontend build and run |
| npm | 10+ | Package management |
| Git | 2.40+ | Version control |
| SQLite | 3.40+ | Database (bundled with .NET) |

### Production

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 24+ | Container runtime |
| Docker Compose | 2.20+ | Multi-container orchestration |
| cloudflared | Latest | (Optional) Zero-trust tunnel |

---

## Local Development

### Step 1: Clone the Repository

```bash
git clone https://github.com/PraveenAsthana123/slp.git
cd slp
```

### Step 2: Start the Backend

```bash
cd SLPSystems/SLPSystems.Web

# Restore and run
dotnet run

# Backend available at:
# API:     http://localhost:5062
# Swagger: http://localhost:5062/swagger
# Health:  http://localhost:5062/api/health
```

On first run, EF Core will:
1. Create `slpsystems.db` (SQLite)
2. Apply all migrations
3. Seed roles, admin user, and sample data

### Step 3: Start the Frontend

```bash
# New terminal
cd slp-frontend

# Create env file
echo "NEXT_PUBLIC_API_URL=http://localhost:5062" > .env.local

# Install dependencies and run
npm install
npm run dev

# Frontend available at:
# http://localhost:3000
```

### Step 4: Verify

| URL | Expected |
|-----|----------|
| http://localhost:3000 | Public homepage |
| http://localhost:3000/admin | Admin login page |
| http://localhost:3000/careers | Job listings |
| http://localhost:5062/api/health | `{"status":"Healthy"}` |
| http://localhost:5062/swagger | API documentation |

### Admin Credentials (Seed Data)

```
Email:    admin@slpsystems.ca
Password: Admin@123456
```

---

## Docker Compose Deployment

### Architecture

```
              ┌──────────┐
              │  Nginx   │ :80/:443
              │  Proxy   │
              └────┬─────┘
           ┌───────┼───────┐
           │       │       │
      ┌────▼──┐ ┌──▼───┐ ┌─▼──────┐
      │ Front │ │ API  │ │ SignalR │
      │ :3000 │ │:5062 │ │ (WS)   │
      └───────┘ └──┬───┘ └────────┘
                   │
              ┌────▼─────┐
              │  SQLite  │
              │ (volume) │
              └──────────┘
```

### Step 1: Configure Environment

```bash
cp .env.template .env
# Edit .env with your values:
# - NEXT_PUBLIC_API_URL (your domain or IP)
# - SMTP credentials
# - Admin password (change from default!)
```

### Step 2: Build and Start

```bash
# Build all images and start
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Step 3: Verify Deployment

```bash
# Health check
curl http://localhost/api/health

# Frontend
curl -I http://localhost

# Check all containers are healthy
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

### docker-compose.yml Services

| Service | Image | Port | Health Check | Depends On |
|---------|-------|------|-------------|-----------|
| `slp-backend` | Custom (.NET 8 Alpine) | 5062 | `GET /api/health` every 30s | — |
| `slp-frontend` | Custom (Node 20 Alpine) | 3000 | `GET /` every 30s | backend |
| `slp-nginx` | nginx:1.25-alpine | 80, 443 | `curl localhost` every 30s | frontend, backend |

### Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `slp-data` | `/app/data` (backend) | SQLite database persistence |
| `slp-logs` | `/app/logs` (backend) | Serilog log files |

---

## GitHub Actions CI/CD

### Workflows

#### CI Pipeline (`.github/workflows/ci.yml`)

Triggers on every push/PR to `main` and `develop`.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Frontend    │    │   Backend    │    │   Security   │
│  Lint+Build  │    │  Build+Test  │    │    Scan      │
│──────────────│    │──────────────│    │──────────────│
│ npm ci       │    │ dotnet restore│   │ trufflehog   │
│ eslint       │    │ dotnet build │    │ trivy scan   │
│ tsc --noEmit │    │ dotnet test  │    │              │
│ npm run build│    │ dotnet publish│   │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

#### Deploy Pipeline (`.github/workflows/deploy.yml`)

Manual trigger (`workflow_dispatch`) with environment selection.

```
Build Docker    →    Push to GHCR    →    SSH Deploy    →    Health Check
(multi-stage)        (ghcr.io)            (docker pull)      (curl /api/health)
```

### Required GitHub Secrets

| Secret | Value | Used By |
|--------|-------|---------|
| `DEPLOY_HOST` | `your-server.com` | deploy.yml |
| `DEPLOY_USER` | `deploy` | deploy.yml |
| `DEPLOY_SSH_KEY` | SSH private key | deploy.yml |
| `DEPLOY_PORT` | `22` | deploy.yml |
| `NEXT_PUBLIC_API_URL` | `https://yourdomain.com` | deploy.yml |

### Setting Up

1. Go to repo → Settings → Secrets and variables → Actions
2. Add each secret from the table above
3. Push to `main` to trigger CI
4. Use Actions → Deploy → Run workflow to deploy

---

## SSL/HTTPS Setup

### Option A: Let's Encrypt (Free)

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy to nginx directory
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
```

### Option B: Cloudflare (Free)

If using Cloudflare as DNS provider:
1. Enable "Full (strict)" SSL in Cloudflare dashboard
2. Generate an Origin Certificate (15 years)
3. Download and place in `nginx/ssl/`

### Enable in Nginx

Edit `nginx/nginx.conf` — uncomment the HTTPS server block:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # ... same location blocks as port 80 ...
}
```

Then restart: `docker compose restart nginx`

### Auto-Renewal (Let's Encrypt)

```bash
# Add to crontab
0 3 * * * certbot renew --post-hook "docker compose restart nginx"
```

---

## Cloudflare Setup

### Domain Configuration

1. Add your domain to Cloudflare (free plan)
2. Update nameservers at your registrar
3. Create DNS records:
   - `A` → `yourdomain.com` → your server IP (proxied)
   - `CNAME` → `www` → `yourdomain.com` (proxied)

### Cloudflare Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| SSL/TLS | Full (strict) | End-to-end encryption |
| Always Use HTTPS | On | Force HTTPS |
| Auto Minify | CSS + JS + HTML | Performance |
| Brotli | On | Compression |
| Browser Cache TTL | 4 hours | Reduce origin requests |

### Named Tunnel (Persistent URL)

```bash
# Login (one-time)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create slp-systems

# Configure
cat > ~/.cloudflared/config.yml << EOF
tunnel: <tunnel-id>
credentials-file: /home/user/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:80
  - service: http_status:404
EOF

# Run as service
sudo cloudflared service install
sudo systemctl start cloudflared
```

---

## VPS Requirements

### Minimum Specs

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB |
| Storage | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Bandwidth | 1 TB/mo | 2 TB/mo |

### Estimated Resource Usage

| Service | RAM | CPU | Disk |
|---------|-----|-----|------|
| .NET Backend | ~150 MB | Low | ~100 MB (app + DB) |
| Next.js Frontend | ~200 MB | Low | ~300 MB (node_modules + .next) |
| Nginx | ~10 MB | Minimal | ~5 MB |
| Docker overhead | ~200 MB | Low | ~500 MB |
| **Total** | **~560 MB** | — | **~1 GB** |

### Recommended VPS Providers

- DigitalOcean ($6-12/mo)
- Hetzner ($4-8/mo)
- Linode ($5-10/mo)
- Vultr ($5-10/mo)

---

## Health Check Verification

### Endpoints to Monitor

```bash
# Backend API health
curl -s http://localhost/api/health | jq .

# Frontend health
curl -I http://localhost/

# Nginx health
curl -s http://localhost/ -o /dev/null -w "%{http_code}"

# SignalR hub (should return 400 — normal for non-WS request)
curl -s http://localhost/hubs/chat -o /dev/null -w "%{http_code}"
# Expected: 400
```

### Docker Health Checks

```bash
# Check all container health
docker compose ps

# Expected output:
# slp-backend    running (healthy)
# slp-frontend   running (healthy)
# slp-nginx      running (healthy)
```

### Health Check Configuration

| Service | Endpoint | Interval | Timeout | Retries |
|---------|----------|----------|---------|---------|
| Backend | `GET /api/health` | 30s | 10s | 3 |
| Frontend | `GET /` | 30s | 10s | 3 |
| Nginx | `curl localhost` | 30s | 10s | 3 |

---

## Rollback Procedure

### Quick Rollback (Docker)

```bash
# 1. List available images
docker images | grep slp

# 2. Roll back to previous version
docker compose down
docker tag slp-backend:previous slp-backend:latest
docker tag slp-frontend:previous slp-frontend:latest
docker compose up -d

# 3. Verify
docker compose ps
curl http://localhost/api/health
```

### Database Rollback

```bash
# 1. Stop the backend
docker compose stop backend

# 2. Restore from backup
cp backups/slpsystems-YYYYMMDD.db data/slpsystems.db

# 3. Restart
docker compose start backend
```

### Git-Based Rollback

```bash
# 1. Find the last good commit
git log --oneline -10

# 2. Check out that commit
git checkout <commit-hash>

# 3. Rebuild and deploy
docker compose up -d --build
```

---

## Monitoring & Logs

### Application Logs

```bash
# Real-time backend logs
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend

# Nginx access logs
docker compose logs nginx
```

### Log Files (Serilog)

Log files are written to the `slp-logs` volume:

```bash
# Access log files from host
docker compose exec backend ls /app/logs/

# Read recent log
docker compose exec backend cat /app/logs/slpsystems-20260305.log | tail -50
```

### Admin Monitoring Dashboard

Available at `/admin` (requires Admin login):

| Page | What It Shows |
|------|--------------|
| **Dashboard** | Messages, subscribers, blog posts, services counts |
| **Health** | DB size, memory usage, uptime, environment, record counts |
| **API Tracking** | Request volume, avg response time, error rate, top endpoints |
| **Audit Log** | All admin actions with user, timestamp, and details |
| **Logs** | Recent application log entries (filterable by level) |

### Database Backup Cron

```bash
# Add to crontab for daily backups
0 2 * * * docker compose exec -T backend cp /app/data/slpsystems.db /app/data/backups/slpsystems-$(date +\%Y\%m\%d).db

# Keep last 7 days
0 3 * * * find /path/to/slp/data/backups -name "*.db" -mtime +7 -delete
```

---

## Troubleshooting

### Backend Won't Start

**Symptom**: `HostAbortedException` in logs

**Cause**: Normal clean-shutdown signal (not an error). If seen during `dotnet ef migrations add`, it's expected — the migration was still created.

**Fix**: Check the actual error above the `HostAbortedException`. If no other error, the app started fine.

---

### SignalR Chat Not Working

**Symptom**: Chat widget connects but messages don't arrive

**Cause**: Nginx not forwarding WebSocket upgrade headers

**Fix**: Ensure `nginx.conf` has the `/hubs/` location with:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

### CORS Errors in Browser

**Symptom**: `Access-Control-Allow-Origin` errors in browser console

**Cause**: Frontend URL not in backend's `AllowedOrigins`

**Fix**: Add your frontend URL to `appsettings.json`:
```json
"AllowedOrigins": ["https://your-frontend-url.com"]
```

---

### Database Locked

**Symptom**: `SQLite Error: database is locked`

**Cause**: Multiple concurrent write operations

**Fix**: WAL mode should handle this. If persistent:
1. Ensure only one backend instance runs
2. Check for orphaned `slpsystems.db-wal` or `slpsystems.db-shm` files
3. Restart the backend: `docker compose restart backend`

---

### Frontend Build Fails in Docker

**Symptom**: `npm run build` fails with memory error

**Cause**: Node.js running out of memory during build

**Fix**: Increase memory limit in Dockerfile:
```dockerfile
ENV NODE_OPTIONS="--max_old_space_size=4096"
```

---

### Container Keeps Restarting

**Symptom**: Container status shows "restarting"

**Cause**: Health check failing

**Fix**:
```bash
# Check what's wrong
docker compose logs backend --tail=50

# Temporarily disable health check to investigate
docker compose exec backend curl localhost:5062/api/health
```

---

### Rate Limit (429) Errors

**Symptom**: Getting `429 Too Many Requests`

**Cause**: Rate limiter triggered

**Fix**: Increase limits in `appsettings.json`:
```json
"RateLimit": { "MaxRequests": 200, "WindowSeconds": 60 }
```

---

### EF Core Migration Errors

**Symptom**: `dotnet ef` commands fail

**Fix**:
```bash
# Ensure EF tools are installed
dotnet tool install --global dotnet-ef

# If DB is corrupted, reset (dev only!)
rm slpsystems.db*
dotnet ef database update
```

---

*Last updated: 2026-03-05*
