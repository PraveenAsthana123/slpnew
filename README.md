# SLP Systems Portal

> **IT Management. SIMPLIFIED.**
> Full-stack enterprise portal for SLP Systems — a Canadian IT consulting firm specializing in Data Engineering, AI/ML, and Cloud Infrastructure.

---

## Table of Contents

- [Overview](#overview)
- [Business Requirements](#business-requirements)
- [Tech Stack](#tech-stack)
- [Tools & Libraries](#tools--libraries)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [API Reference](#api-reference)

---

## Overview

The SLP Systems Portal is a multi-role, full-stack web application that serves three distinct audiences:

| Audience | Entry Point | Purpose |
|----------|------------|---------|
| **Public** | `/` | Company website — services, blog, careers, contact |
| **Admin** | `/admin` | Content management, analytics, customer support |
| **Customer** | `/customer` | Self-service portal — articles, live chat, account |

---

## Business Requirements

### BRD — Business Requirements Document

#### 1. Stakeholders
- **SLP Systems Management** — content control, lead management, hiring pipeline
- **Sales & Marketing** — lead capture, newsletter, campaign tracking
- **HR Team** — job posting management, application review
- **Customers / Prospects** — self-service support, knowledge base, live chat

#### 2. Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-01 | Public-facing company website with dynamic content (services, blog, testimonials, case studies) | P0 |
| FR-02 | Admin panel for managing all site content without developer involvement | P0 |
| FR-03 | Contact form with email notification and admin tracking | P0 |
| FR-04 | Blog platform with categories, search, and rich text editing | P0 |
| FR-05 | Newsletter subscription with subscriber management | P1 |
| FR-06 | Real-time live chat between customers and support agents | P1 |
| FR-07 | Customer self-service portal with authentication | P1 |
| FR-08 | Careers section with job listings and application workflow | P1 |
| FR-09 | Admin job posting management with rich text editor | P1 |
| FR-10 | Role-based access control (Admin, Editor, HR, Sales, Customer) | P0 |
| FR-11 | Site configuration panel for social media, SMTP, and feature flags | P2 |
| FR-12 | Open Graph / Twitter Card meta tags for social media sharing | P2 |
| FR-13 | CI/CD pipeline for automated testing and deployment | P1 |
| FR-14 | Docker-based containerized deployment | P1 |

#### 3. Non-Functional Requirements

| Category | Requirement |
|----------|------------|
| **Performance** | API responses < 500ms (p95); frontend LCP < 2.5s |
| **Security** | HTTPS only in production; secure headers (CSP, HSTS); rate limiting; cookie-based auth |
| **Scalability** | Horizontal scaling via Docker Compose; SQLite → PostgreSQL migration path available |
| **Availability** | 99.9% uptime target; health checks on all services |
| **Accessibility** | WCAG 2.1 AA compliance; keyboard navigation; ARIA labels |
| **SEO** | Server-side rendering; structured metadata; Open Graph; sitemap |
| **Compliance** | PIPEDA-compliant data handling; no PII logging |

#### 4. Constraints
- Database: SQLite for MVP (no external DB dependency); migration-ready for PostgreSQL
- Email: SendGrid (SMTP relay) for transactional emails
- Hosting: Single VPS (Docker Compose); Cloudflare CDN/tunnel for zero-config SSL
- Budget: Open-source toolchain only (no paid SaaS dependencies at runtime)

---

## Tech Stack

### Backend — .NET 8 ASP.NET Core
| Layer | Technology |
|-------|-----------|
| Framework | ASP.NET Core 8 Web API |
| ORM | Entity Framework Core 8 |
| Database | SQLite (via EF Core) |
| Auth | ASP.NET Core Identity + Cookie Authentication |
| Real-time | SignalR (WebSocket hub) |
| Email | System.Net.Mail / SendGrid SMTP |
| Logging | Microsoft.Extensions.Logging (structured) |
| Architecture | Repository Pattern + Unit of Work + Service Layer |

### Frontend — Next.js 13+
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 13+ (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Rich Text | Tiptap (ProseMirror-based WYSIWYG) |
| Real-time | @microsoft/signalr (WebSocket client) |
| Rendering | SSR + CSR hybrid (Next.js App Router) |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Container Runtime | Docker + Docker Compose |
| Reverse Proxy | Nginx 1.25 (Alpine) |
| CI/CD | GitHub Actions |
| Registry | GitHub Container Registry (GHCR) |
| Tunneling (Dev) | Cloudflare Quick Tunnels (`cloudflared`) |
| SSL (Production) | Let's Encrypt / Cloudflare (Nginx config ready) |

---

## Tools & Libraries

### Backend Packages
```
Microsoft.AspNetCore.Identity.EntityFrameworkCore  — auth & user management
Microsoft.EntityFrameworkCore.Sqlite               — SQLite data access
Microsoft.AspNetCore.SignalR                       — real-time WebSocket hub
Swashbuckle.AspNetCore                             — Swagger/OpenAPI docs
```

### Frontend Packages
```
@tiptap/react + @tiptap/starter-kit                — rich text editor (job postings, blog)
@microsoft/signalr                                 — SignalR client for live chat
next                                               — React framework (SSR, routing, metadata)
tailwindcss                                        — utility-first CSS
typescript                                         — type safety
```

### Developer Tools
```
dotnet-ef                  — EF Core migrations CLI
Node.js 20 + npm           — frontend package management
cloudflared                — zero-config HTTPS tunnel for remote sharing
Docker + Docker Compose    — containerized local and production stack
GitHub Actions             — CI/CD (lint → build → security scan → deploy)
```

---

## Features

### Public Website
- **Home** — animated hero carousel, services showcase, industry solutions, case studies, team, testimonials, blog preview, newsletter signup
- **Services** — individual service pages with dynamic content from admin
- **Industries** — banking, healthcare, retail, manufacturing, and more
- **Blog** — searchable, categorized articles with pagination and full article view
- **Careers** — job listings with department filter, salary ranges, and inline apply modal
- **About** — team, mission, company story
- **Contact** — multi-field form with CAPTCHA-ready structure and admin tracking
- **Live Chat Widget** — floating chat button on every public page (SignalR-powered)

### Admin Panel (`/admin`)
| Section | Capabilities |
|---------|-------------|
| Dashboard | Stats overview — messages, subscribers, blog posts, chat sessions |
| Blog | Create / edit / delete posts with rich text; manage categories |
| Services | CRUD for service cards shown on homepage and services page |
| Testimonials | Add/edit client testimonials with star ratings |
| Case Studies | Manage portfolio case studies |
| Industries | Industry solution pages content management |
| Team | Team member profiles with social links |
| Videos | Video demo management |
| **Jobs** | Create/edit/delete job postings with Tiptap rich text editor; review applications; update status (New → Reviewed → Shortlisted → Rejected) |
| **Live Chat** | Two-panel real-time chat — session list + conversation view; unread badges |
| Chat Requests | Manage inbound chat requests from contact widget |
| Messages | Contact form submissions with read/resolve tracking |
| Newsletter | Subscriber list management |
| Users | Role management (Admin, Editor, HR, Sales, Customer) |
| Audit Log | System-wide action audit trail |
| API Tracking | Request volume and error rate monitoring |
| Logs | Live log viewer |
| Health | Backend health dashboard (DB size, uptime, memory) |
| **Config** | Social media URLs + UTM campaign links; SMTP test; feature flags; integration status |
| Settings | Company info, contact details, SMTP credentials, Google Maps embed |

### Customer Portal (`/customer`)
| Section | Description |
|---------|-------------|
| Dashboard | Welcome card, featured articles carousel, stats, quick actions |
| Blog & Resources | Browse and read all published blog posts |
| Live Chat | Persistent chat sessions with support team |
| Login / Register | Cookie-based authentication |

### Real-time Live Chat
- Customer opens chat widget → enters name + email → connects via SignalR
- Admin receives instant notification in `/admin/live-chat`
- Full message history persisted in database
- Unread badge counts and per-session read tracking
- Customer chat sessions visible in Customer Portal

### Careers Module
- Public listings page with department filter and salary display
- Individual job detail page with full description, requirements, apply modal
- Apply form: name, email, phone, LinkedIn, portfolio, cover letter
- Admin management: create/edit jobs with Tiptap WYSIWYG editor
- Applications inbox with status workflow and admin notes
- 4 seeded Data Engineering / AI/ML jobs on first run

### Social Media Campaign
- Full Open Graph meta tags (Facebook, LinkedIn)
- Twitter Card meta tags
- Auto-generated OG images via Next.js `ImageResponse` (no external tools)
- Config panel generates UTM campaign links for each social network
- `NEXT_PUBLIC_SITE_URL` drives canonical URLs and OG image base

---

## Project Structure

```
slp/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint → Build → Security scan on every PR
│       └── deploy.yml          # Docker build → GHCR push → SSH deploy
│
├── SLPSystems/
│   └── SLPSystems.Web/         # .NET 8 ASP.NET Core backend
│       ├── Controllers/Api/    # HTTP endpoints (thin layer)
│       ├── Data/               # EF DbContext + SeedData
│       ├── Hubs/               # SignalR ChatHub
│       ├── Middleware/         # Rate limiting, exception handling, request tracking
│       ├── Migrations/         # EF Core migration history
│       ├── Models/Entities/    # Domain entities
│       ├── Repositories/       # Unit of Work + Repository interfaces/implementations
│       ├── Services/           # Business logic (blog, email, contact, newsletter)
│       ├── Program.cs          # App bootstrap, middleware pipeline, DI registration
│       └── appsettings.json    # Default configuration
│
├── slp-frontend/               # Next.js 13+ frontend
│   └── src/
│       ├── app/
│       │   ├── (public)/       # Home, services, industries, blog, careers, contact
│       │   ├── admin/          # Admin panel pages
│       │   └── customer/       # Customer portal pages
│       ├── components/
│       │   ├── admin/          # Shared admin UI components
│       │   ├── chat/           # LiveChatWidget
│       │   ├── editor/         # RichTextEditor (Tiptap)
│       │   ├── home/           # Homepage section components
│       │   └── layout/         # Navbar, Footer, LayoutWrapper
│       └── lib/
│           └── api.ts          # Typed API client for all backend endpoints
│
├── nginx/
│   └── nginx.conf              # Reverse proxy: /api/* → backend, /hubs/* → SignalR, /* → frontend
│
├── docker-compose.yml          # Full stack: backend + frontend + nginx
├── .env.template               # All required environment variables documented
└── .gitignore                  # Excludes .env, *.db, node_modules, bin/obj, SSL certs
```

---

## Getting Started

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [Docker + Docker Compose](https://docs.docker.com/get-docker/) (for containerized run)

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/PraveenAsthana123/slp.git
cd slp

# 2. Copy and configure env vars
cp .env.template .env
# Edit .env with your values (SMTP, admin credentials, etc.)

# 3. Start the .NET backend
cd SLPSystems/SLPSystems.Web
dotnet run
# API available at http://localhost:5062
# Swagger UI at http://localhost:5062/swagger

# 4. Start the Next.js frontend (new terminal)
cd slp-frontend
cp .env.template .env.local    # or create manually
echo "NEXT_PUBLIC_API_URL=http://localhost:5062" > .env.local
npm install
npm run dev
# Frontend available at http://localhost:3000
```

### Admin Login (seed data)
```
URL:      http://localhost:3000/auth/login
Email:    admin@slpsystems.ca
Password: Admin@123456
```

### Remote Sharing (Cloudflare Tunnel)
```bash
# Expose frontend to the internet (no account needed)
cloudflared tunnel --url http://localhost:3000

# Expose backend (for SignalR from remote browsers)
cloudflared tunnel --url http://localhost:5062
# → Update NEXT_PUBLIC_API_URL in .env.local with the backend tunnel URL
# → Add the frontend tunnel URL to AllowedOrigins in appsettings.json
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:5062` | Backend URL (browser-accessible) |
| `NEXT_PUBLIC_SITE_URL` | No | `https://slpsystems.ca` | Canonical site URL for OG meta tags |
| `ADMIN_EMAIL` | Yes | `admin@slpsystems.ca` | Seed admin email |
| `ADMIN_PASSWORD` | Yes | `Admin@123456` | Seed admin password (change in production!) |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Allowed CORS origin for backend |
| `SMTP_HOST` | No | — | SMTP server (e.g. `smtp.sendgrid.net`) |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USERNAME` | No | — | SMTP username (use `apikey` for SendGrid) |
| `SMTP_PASSWORD` | No | — | SMTP password / API key |
| `RATE_LIMIT` | No | `100` | Max requests per minute per IP |

See [.env.template](.env.template) for the full list.

---

## Deployment

### Docker Compose (Recommended)

```bash
# Copy and fill in production values
cp .env.template .env

# Build and start all services
docker compose up -d --build

# Check service health
docker compose ps
docker compose logs backend --tail=50
```

Services started:
- `slp-backend` → port 5062
- `slp-frontend` → port 3000
- `slp-nginx` → port 80 (and 443 when SSL configured)

### GitHub Actions CI/CD

Every push to `main` triggers:
1. **Frontend** — ESLint + TypeScript check + Next.js build
2. **Backend** — `dotnet build` + `dotnet test`
3. **Security** — TruffleHog secrets scan + Trivy filesystem scan

Every manual dispatch to `production` triggers:
1. Docker multi-stage build → push to GHCR
2. SSH deploy to server → `docker compose pull && docker compose up -d`

Required GitHub Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PORT`, `NEXT_PUBLIC_API_URL`

### SSL / HTTPS

The Nginx config includes a pre-configured HTTPS server block (commented out). To enable:

```bash
# 1. Place your SSL certificate files
mkdir -p nginx/ssl
cp fullchain.pem nginx/ssl/
cp privkey.pem  nginx/ssl/

# 2. Uncomment the HTTPS server block in nginx/nginx.conf

# 3. Replace yourdomain.com with your actual domain

# 4. Restart nginx
docker compose restart nginx
```

---

## API Reference

Swagger UI (development only): `http://localhost:5062/swagger`

### Key Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | — | Backend health check |
| GET | `/api/home/settings` | — | Site settings (public) |
| GET | `/api/blog` | — | Blog posts list |
| GET | `/api/blog/slug/{slug}` | — | Single blog post |
| GET | `/api/jobs` | — | Active job listings |
| GET | `/api/jobs/slug/{slug}` | — | Single job detail |
| POST | `/api/jobs/{id}/apply` | — | Submit job application |
| POST | `/api/contact` | — | Send contact message |
| POST | `/api/customer/auth/register` | — | Customer register |
| POST | `/api/customer/auth/login` | — | Customer login |
| WS | `/hubs/chat` | — | SignalR live chat hub |
| GET | `/api/jobs/admin/all` | Admin/HR | All job postings |
| PUT | `/api/jobs/{id}` | Admin/HR | Update job posting |
| GET | `/api/jobs/admin/applications` | Admin/HR | All applications |
| GET | `/api/admin/dashboard/stats` | Admin | Dashboard statistics |

---

## Roles & Permissions

| Role | Admin Panel Access | Customer Portal |
|------|--------------------|----------------|
| **Admin** | Full access (all sections) | — |
| **Editor** | Blog, Services, Team, Case Studies | — |
| **HR** | Jobs, Users | — |
| **Sales** | Messages, Chat Requests, Live Chat, Newsletter | — |
| **Customer** | — | Dashboard, Blog, Chat |

---

## Contributing

1. Create a branch: `feature/your-feature` or `fix/your-bugfix`
2. Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`
3. Ensure TypeScript compiles: `npx tsc --noEmit`
4. Open a PR against `develop`

---

*Built with ❤️ by the SLP Systems team — Calgary, Alberta, Canada*
