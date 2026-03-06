# High-Level Design (HLD)
## SLP Systems Corporate Portal

**Document Version:** 1.0  
**Date:** 2026-03-03  
**Status:** Approved  
**Project:** SLP Systems IT Management & AI Solutions Portal  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Context Diagram](#2-system-context-diagram)
3. [Component Architecture Diagram](#3-component-architecture-diagram)
4. [Data Flow Between Layers](#4-data-flow-between-layers)
5. [Key Design Decisions](#5-key-design-decisions)
6. [Scalability Considerations](#6-scalability-considerations)
7. [Security Boundaries](#7-security-boundaries)
8. [Deployment Topology](#8-deployment-topology)
9. [Entity Relationship Overview](#9-entity-relationship-overview)
10. [Non-Functional Requirements](#10-non-functional-requirements)

---

## 1. System Overview

The SLP Systems Portal is a full-stack corporate web application that serves as the public-facing website and internal administration platform for SLP Systems — an IT management and AI solutions company based in Canada.

### 1.1 Purpose

The system provides two distinct audiences with tailored experiences:

- **Public Visitors**: Browse services, read blog posts, view case studies, explore industry solutions, apply for jobs, and initiate live chat with support staff.
- **Administrators**: Manage all website content (blog, services, testimonials, case studies, team members), respond to live chat sessions in real time, review contact messages, monitor newsletter subscribers, track API usage, view audit logs, and configure site-wide settings.

### 1.2 Business Functions

| Domain | Public Capabilities | Admin Capabilities |
|--------|-------------------|-------------------|
| Blog | Read posts, filter by category | Create, edit, publish, delete posts |
| Services | View service catalog | Add, update, reorder services |
| Case Studies | Browse success stories | Manage case study records |
| Careers | View job postings, submit applications | Post jobs, review applications |
| Live Chat | Initiate real-time chat session | Monitor and reply to all active sessions |
| Contact | Submit inquiry form | Review and manage contact messages |
| Newsletter | Subscribe by email | Manage subscribers, export list |
| Team | View team profiles | Add and update team member records |
| Industries | Browse industry-specific solutions | Manage industry content |
| Testimonials | See customer testimonials | Moderate testimonial records |
| Settings | N/A | Configure site metadata, SMTP, branding |

### 1.3 Technology Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend API | ASP.NET Core 8 Web API, Entity Framework Core 8 |
| Real-time | SignalR (WebSocket) via `@microsoft/signalr` |
| Rich Text | Tiptap v3 editor |
| Database | SQLite (EF Core with WAL mode) |
| Auth | ASP.NET Core Identity + Cookie Authentication |
| Reverse Proxy | Nginx 1.25-alpine |
| Containerisation | Docker + Docker Compose |
| Logging | Serilog (console + rolling file, structured) |

---

## 2. System Context Diagram

This diagram shows all external actors and systems that interact with the SLP Systems portal.

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                          SYSTEM CONTEXT — SLP Systems Portal                    ║
╚══════════════════════════════════════════════════════════════════════════════════╝

                        ┌─────────────────────┐
                        │   Public Visitor     │
                        │  (anonymous user)    │
                        │  - Browser/Mobile    │
                        └──────────┬──────────┘
                                   │ HTTPS (80/443)
                                   │ Browse pages, submit forms,
                                   │ read blog, initiate chat,
                                   │ apply for jobs
                                   │
                        ┌──────────▼──────────┐
                        │   Customer Portal   │
                        │  (authenticated)    │
                        │  - Login/register   │
                        │  - View dashboard   │
                        └──────────┬──────────┘
                                   │ HTTPS
                                   │
                   ┌───────────────▼───────────────┐
                   │                               │
                   │       SLP Systems Portal      │
                   │     [THIS SYSTEM]             │
                   │                               │
                   │  - Corporate website          │
                   │  - Content management         │
                   │  - Live chat platform         │
                   │  - Job portal                 │
                   │  - Admin dashboard            │
                   └───────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
   ┌──────────▼──────────┐  ┌──────▼──────┐  ┌─────────▼────────┐
   │   SMTP Mail Server  │  │  Host OS /  │  │  Docker Volume   │
   │  (external service) │  │  Filesystem │  │  (SQLite DB +    │
   │                     │  │             │  │   logs)          │
   │  - Contact emails   │  │  - Static   │  │                  │
   │  - Newsletter conf  │  │    assets   │  │  slp-data:/app/  │
   │  - Job app notify   │  │             │  │  slp-logs:/logs  │
   └─────────────────────┘  └─────────────┘  └──────────────────┘
              ▲
              │ (future)
   ┌──────────┴──────────┐
   │   SLP Administrator │
   │   (internal staff)  │
   │  - Admin dashboard  │
   │  - Content mgmt     │
   │  - Live chat mgmt   │
   └─────────────────────┘
```

---

## 3. Component Architecture Diagram

This diagram shows the internal component structure and request routing from browser to database.

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                        COMPONENT ARCHITECTURE — SLP Systems Portal                      ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝

  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │  CLIENT LAYER                                                                    │
  │                                                                                  │
  │   ┌───────────────────────┐       ┌───────────────────────┐                     │
  │   │  Public Browser       │       │  Admin Browser        │                     │
  │   │  (anonymous / guest)  │       │  (authenticated admin) │                     │
  │   └──────────┬────────────┘       └──────────┬────────────┘                     │
  └──────────────┼─────────────────────────────────┼────────────────────────────────┘
                 │ HTTPS :80/:443                   │ HTTPS :80/:443
                 │                                  │
  ┌──────────────▼──────────────────────────────────▼────────────────────────────────┐
  │  INGRESS LAYER — Nginx 1.25 Alpine                                               │
  │                                                                                  │
  │   ┌─────────────────────────────────────────────────────────────────────────┐   │
  │   │  nginx.conf                                                              │   │
  │   │  ├── Rate limiting zones (api: 20r/s  general: 50r/s)                   │   │
  │   │  ├── Security headers (X-Frame-Options, X-Content-Type-Options, etc.)    │   │
  │   │  ├── Gzip compression (text, CSS, JSON, JS)                              │   │
  │   │  ├── /api/*         → upstream backend:5062  (HTTP proxy)                │   │
  │   │  ├── /hubs/*        → upstream backend:5062  (WebSocket upgrade)         │   │
  │   │  ├── /swagger/*     → upstream backend:5062  (dev only)                  │   │
  │   │  └── /*             → upstream frontend:3000  (Next.js SSR)              │   │
  │   └─────────────────────────────────────────────────────────────────────────┘   │
  └──────────────┬────────────────────────────────────┬───────────────────────────────┘
                 │ :3000                              │ :5062
  ┌──────────────▼──────────────┐      ┌──────────────▼──────────────────────────────┐
  │  FRONTEND — Next.js 14      │      │  BACKEND — ASP.NET Core 8 Web API           │
  │  (App Router, React 18,     │      │                                             │
  │   TypeScript, Tailwind CSS) │      │  ┌─────────────────────────────────────┐   │
  │                             │      │  │  Middleware Pipeline                 │   │
  │  ┌─────────────────────┐   │      │  │  CorrelationIdMiddleware             │   │
  │  │  App Router Pages   │   │      │  │  GlobalExceptionMiddleware           │   │
  │  │  /                  │   │      │  │  SecurityHeadersMiddleware           │   │
  │  │  /about             │   │      │  │  RateLimitingMiddleware (100 req/min)│   │
  │  │  /services          │   │      │  │  UseAuthentication                   │   │
  │  │  /blog              │   │      │  │  UseAuthorization                    │   │
  │  │  /careers           │   │      │  │  ApiRequestTrackingMiddleware        │   │
  │  │  /industries        │   │      │  │  Serilog Request Logging             │   │
  │  │  /contact           │   │      │  └─────────────────────────────────────┘   │
  │  │  /customer/*        │   │      │                                             │
  │  │  /admin/*           │   │      │  ┌─────────────────────────────────────┐   │
  │  └─────────────────────┘   │      │  │  Controllers                        │   │
  │                             │      │  │  AuthController                     │   │
  │  ┌─────────────────────┐   │      │  │  BlogController                     │   │
  │  │  Components         │   │      │  │  ServicesController                  │   │
  │  │  - Tiptap Editor    │   │      │  │  CaseStudiesController               │   │
  │  │  - Live Chat Widget │   │      │  │  ContactController                   │   │
  │  │  - Admin Sidebar    │   │      │  │  JobsController                      │   │
  │  │  - Data Tables      │   │      │  │  NewsletterController                │   │
  │  └─────────────────────┘   │      │  │  TeamController                      │   │
  │                             │      │  │  TestimonialsController              │   │
  │  ┌─────────────────────┐   │      │  │  IndustriesController                │   │
  │  │  SignalR Client      │   │◄─────┼──│  LiveChatController                  │   │
  │  │  @microsoft/signalr │◄──┼──WS──┼──│  AdminDashboardController            │   │
  │  └─────────────────────┘   │      │  │  UsersController                     │   │
  │                             │      │  │  VideosController                    │   │
  └─────────────────────────────┘      │  │  HomeController                      │   │
                                       │  │  AdminMonitoringController           │   │
                  HTTP fetch           │  └────────────────┬────────────────────┘   │
                  /api/*               │                    │                        │
                                       │  ┌────────────────▼────────────────────┐   │
                                       │  │  Services (Business Logic)           │   │
                                       │  │  BlogService                         │   │
                                       │  │  ContactService                      │   │
                                       │  │  NewsletterService                   │   │
                                       │  │  EmailService                        │   │
                                       │  │  SiteService                         │   │
                                       │  │  DataCleanupService (HostedService)  │   │
                                       │  └────────────────┬────────────────────┘   │
                                       │                    │                        │
                                       │  ┌────────────────▼────────────────────┐   │
                                       │  │  Unit of Work + Repositories         │   │
                                       │  │  IUnitOfWork → UnitOfWork            │   │
                                       │  │  BlogRepository                      │   │
                                       │  │  ServiceRepository                   │   │
                                       │  │  CaseStudyRepository                 │   │
                                       │  │  ContactRepository                   │   │
                                       │  │  NewsletterRepository                │   │
                                       │  │  TeamMemberRepository                │   │
                                       │  │  TestimonialRepository               │   │
                                       │  │  IndustrySolutionRepository          │   │
                                       │  │  ChatRequestRepository               │   │
                                       │  │  ChatMessageRepository               │   │
                                       │  │  JobPostingRepository                │   │
                                       │  │  AuditLogRepository                  │   │
                                       │  │  SiteSettingsRepository              │   │
                                       │  └────────────────┬────────────────────┘   │
                                       │                    │                        │
                                       │  ┌────────────────▼────────────────────┐   │
                                       │  │  ApplicationDbContext (EF Core 8)    │   │
                                       │  │  ASP.NET Core Identity               │   │
                                       │  └────────────────┬────────────────────┘   │
                                       └───────────────────┼────────────────────────┘
                                                           │
                                       ┌───────────────────▼────────────────────┐
                                       │  DATABASE LAYER                         │
                                       │  SQLite — slpsystems.db                 │
                                       │  (WAL mode, Docker volume: slp-data)    │
                                       │                                          │
                                       │  Tables: Services, BlogPosts,           │
                                       │  BlogCategories, Testimonials,           │
                                       │  CaseStudies, TeamMembers,              │
                                       │  ContactMessages, NewsletterSubscribers, │
                                       │  VideoDemos, IndustrySolutions,          │
                                       │  SiteSettings, ChatRequests,            │
                                       │  ChatMessages, AuditLogs,               │
                                       │  ApiRequestLogs, JobPostings,            │
                                       │  JobApplications, AspNetUsers,           │
                                       │  AspNetRoles, AspNetUserRoles           │
                                       └─────────────────────────────────────────┘
```

---

## 4. Data Flow Between Layers

### 4.1 Standard HTTP Request Flow (Content Read)

```
Browser
  │
  ├─ GET /blog
  │
  ▼
Nginx
  │ Route match: /* → upstream frontend:3000
  │ Apply: rate limit (general zone), gzip, security headers
  │
  ▼
Next.js (App Router — Server Component)
  │ Server-side fetch: GET http://backend:5062/api/blog
  │ (internal Docker network, no public exposure)
  │
  ▼
ASP.NET Core Middleware Pipeline
  │ CorrelationIdMiddleware   → attach/generate X-Correlation-Id
  │ GlobalExceptionMiddleware → wrap handler in try/catch
  │ SecurityHeadersMiddleware → add X-Frame-Options, CSP, etc.
  │ RateLimitingMiddleware    → check per-IP sliding window counter
  │ UseAuthentication         → parse cookie (anonymous for public routes)
  │ ApiRequestTrackingMiddleware → log request to ApiRequestLogs table
  │
  ▼
BlogController.GetPosts()
  │ Validates query params (pagination: offset, limit)
  │ Calls BlogService
  │
  ▼
BlogService.GetPublishedPostsAsync()
  │ Applies business rules (published only, ordering, tag filtering)
  │ Calls UnitOfWork.Blog.GetPublishedAsync()
  │
  ▼
BlogRepository → ApplicationDbContext → SQLite
  │ EF Core LINQ → SQL SELECT with WHERE IsPublished = 1 ORDER BY CreatedAt DESC
  │ LIMIT / OFFSET applied for pagination
  │
  ◄ Returns List<BlogPost>
  │
  ◄ BlogService maps to PaginatedResponse<BlogPostSummaryDto>
  │
  ◄ BlogController returns 200 JSON
  │
  ◄ Nginx adds gzip compression if response > threshold
  │
  ◄ Next.js renders HTML via React Server Components
  │
  ◄ Browser receives fully rendered HTML (SSR)
```

### 4.2 Form Submission Flow (Contact Message)

```
Browser
  │ POST /api/contact  { name, email, subject, message }
  │
  ▼
Nginx → RateLimit check → forward to backend:5062
  │
  ▼
ContactController.Submit()
  │ Model binding → ContactRequest DTO (Pydantic-like validation via [Required], [EmailAddress])
  │ ModelState.IsValid check → 400 if invalid
  │
  ▼
ContactService.SubmitAsync()
  │ Save ContactMessage to DB via UnitOfWork.Contacts.AddAsync()
  │ Call EmailService.SendAdminNotificationAsync()  [async, non-blocking]
  │ EmailService connects to configured SMTP server
  │
  ▼
AuditLog entry written → UnitOfWork.AuditLogs.AddAsync()
  │ action = "CONTACT_SUBMITTED", entityType = "ContactMessage"
  │
  ◄ 201 Created response with correlation_id
```

### 4.3 Real-Time Chat Flow (SignalR)

```
Customer Browser                  Admin Browser
      │                                │
      │ GET /                          │ GET /admin/live-chat
      │ Chat widget loads              │ Admin dashboard loads
      │                                │
      ▼                                ▼
SignalR Client connects to       SignalR Client connects to
/hubs/chat via WebSocket         /hubs/chat via WebSocket
(via Nginx upgrade proxy)        (via Nginx upgrade proxy)
      │                                │
      ▼                                ▼
ChatHub.JoinSession(sessionId,   ChatHub.JoinAdminRoom()
        name, email)              → Groups.AddToGroupAsync("admins")
      │
      │ → Groups.AddToGroupAsync("session-{id}")
      │ → Clients.Group("admins").SendAsync("CustomerConnected", ...)
      │                                │
      │                                ◄ Admin sees new session notification
      │
      │ Customer types message
      ▼
ChatHub.SendMessage(sessionId, name, email, content)
      │ → Save ChatMessage to SQLite (IsFromAdmin = false)
      │ → Clients.Group("admins").SendAsync("ReceiveMessage", payload)
      │ → Clients.Group("session-{id}").SendAsync("ReceiveMessage", payload)
      │                                │
      │                                ◄ Admin sees message in real time
      │                                │
      │                        Admin types reply
      │                                ▼
      │                    ChatHub.AdminReply(sessionId, adminName, content)
      │                                │
      │                                │ → Save ChatMessage (IsFromAdmin = true)
      │                                │ → Clients.Group("session-{id}").SendAsync(...)
      │                                │ → Clients.Group("admins").SendAsync(...)
      ◄──────────────────────────────────
Customer sees admin reply in real time
```

### 4.4 Admin Authentication Flow

```
Admin Browser
  │
  │ POST /api/auth/login  { email, password }
  │
  ▼
AuthController.Login()
  │
  ▼
ASP.NET Core Identity
  │ SignInManager.PasswordSignInAsync(email, password, isPersistent: false)
  │ Validates password hash in AspNetUsers (SQLite)
  │ On success → issues HttpOnly, SameSite=None, Secure cookie
  │
  ◄ 200 OK  { user: { id, email, roles: ["Admin"] } }
  │
Browser stores cookie automatically (HttpOnly — not accessible to JS)
  │
Subsequent requests include cookie automatically
  │
  ▼
AuthController / [Authorize] endpoints
  │ ASP.NET Core reads cookie → validates → sets ClaimsPrincipal
  │ [Authorize(Roles = "Admin")] → 403 if not admin role
```

---

## 5. Key Design Decisions

### 5.1 Server-Side Rendering via Next.js App Router

The frontend uses Next.js 14 with the App Router and React Server Components for all public-facing pages. This means HTML is fully rendered on the server before delivery to the browser, providing:

- Optimal SEO for all content pages (blog, services, case studies)
- Fast First Contentful Paint (FCP) and Largest Contentful Paint (LCP)
- No client-side API keys or database credentials exposed
- Reduced client-side JavaScript bundle

Admin pages use client components where interactivity is required (forms, live chat, Tiptap editor).

### 5.2 Decoupled Frontend/Backend via REST API

The frontend communicates with the backend exclusively through the documented REST API at `/api/*`. This separation allows:

- Independent deployment and scaling of each tier
- The backend API to be consumed by future mobile apps or third-party integrations
- A clear contract enforced via Swagger/OpenAPI documentation

### 5.3 SQLite as Primary Database

SQLite is chosen for the current deployment scale. It runs embedded within the backend container and is persisted via a named Docker volume. WAL (Write-Ahead Logging) mode is enabled to support concurrent reads while writes are in progress. See ADR-003 for full rationale.

### 5.4 Unit of Work Pattern

All database operations flow through a single `IUnitOfWork` interface that lazily instantiates individual repositories sharing a single `ApplicationDbContext` instance per HTTP request. This ensures:

- All writes within a request can be committed atomically with one `SaveChangesAsync()` call
- No partial writes when multiple entities are modified together
- Clean dependency injection — controllers and services depend on `IUnitOfWork`, not individual repos

### 5.5 Cookie-Based Authentication

The system uses ASP.NET Core Identity with HttpOnly, SameSite=None, Secure cookies rather than JWT bearer tokens stored in localStorage. This prevents XSS attacks from stealing authentication tokens. The cookie is valid for 8 hours with sliding expiration.

### 5.6 Nginx as Unified Ingress

A single Nginx instance handles all inbound traffic and routes it to the appropriate upstream service. This provides:

- A single TLS termination point
- Nginx-level rate limiting (independent of application layer)
- WebSocket upgrade negotiation for SignalR connections
- Gzip compression before delivery to browser

---

## 6. Scalability Considerations

### 6.1 Current State (Single-Node)

The current architecture is optimised for a single-node deployment where all containers run on one host. This is appropriate for:

- A corporate website with moderate traffic (< 1,000 concurrent users)
- An admin team of 1-5 users managing content
- Live chat sessions in the tens-to-hundreds range

### 6.2 Vertical Scaling

The first scaling lever is increasing resources on the existing host (more CPU cores, more RAM). Nginx handles upstream keep-alive connections and .NET Kestrel uses the thread pool efficiently. SQLite with WAL mode supports multiple simultaneous readers, so read-heavy workloads scale well vertically.

### 6.3 Horizontal Scaling Path

If traffic outgrows a single node, the migration path is:

1. **Replace SQLite with PostgreSQL** — SQLite cannot be written from multiple processes. Switching to PostgreSQL (minimal EF Core change) enables multi-process backend deployments.
2. **Add a Redis layer** — for SignalR backplane (multi-instance WebSocket broadcasting), distributed session state, and API response caching.
3. **Run multiple backend replicas** — behind an Nginx upstream with `least_conn` load balancing.
4. **Containerise with Kubernetes** — horizontal pod autoscaling on backend replicas.

### 6.4 Caching Strategy

Currently, the Next.js App Router provides built-in server component data caching (per-request deduplication and configurable `revalidate` intervals). Static pages (services, about) can be configured with long `revalidate` values (e.g., 300 seconds) to eliminate redundant API calls under load.

### 6.5 Background Jobs

Data cleanup (pruning old audit logs, expired API request logs) runs as an `IHostedService` (`DataCleanupService`). For higher-volume scenarios, this would move to a dedicated job queue (e.g., Hangfire with a PostgreSQL backend).

---

## 7. Security Boundaries

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         SECURITY BOUNDARY MAP                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

  INTERNET (untrusted)
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  All inbound traffic                                                     │
  │  - Mixed: legitimate users, bots, scanners, attackers                   │
  └────────────────────────────┬────────────────────────────────────────────┘
                               │ :80 / :443
  ─────────────────────────────▼──────────────────── BOUNDARY 1: TLS/Rate ──
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  NGINX (DMZ / Ingress)                                                   │
  │  ✓ TLS termination (HTTPS enforcement)                                   │
  │  ✓ Rate limiting (api: 20 req/s, general: 50 req/s)                      │
  │  ✓ Security headers added here                                           │
  │  ✓ Request size limit (client_max_body_size 20M)                         │
  │  ✗ No authentication at this layer (pass-through)                        │
  └──────────────────────┬──────────────────────┬───────────────────────────┘
                         │ :3000                │ :5062
  ─────────────────────────────────────────────────── BOUNDARY 2: App Layer ─
  ┌────────────────────────────┐   ┌───────────────────────────────────────┐
  │  NEXT.JS FRONTEND          │   │  ASP.NET CORE BACKEND                 │
  │  ✓ No sensitive data       │   │  ✓ Cookie auth (HttpOnly, Secure)     │
  │    exposed to browser      │   │  ✓ Role-based authorisation (RBAC)    │
  │  ✓ Server components for   │   │  ✓ Input validation (model binding)   │
  │    server-side data fetch  │   │  ✓ Rate limiting middleware           │
  │  ✓ Admin routes require    │   │  ✓ Security headers middleware         │
  │    authenticated cookie    │   │  ✓ Correlation ID tracking            │
  │  ✓ CORS: configured        │   │  ✓ Global exception handling          │
  │    allowed origins only    │   │  ✓ Parameterised EF Core queries      │
  │                            │   │    (no raw SQL, no injection risk)    │
  └────────────────────────────┘   └───────────────────────────────────────┘
                                                  │
  ─────────────────────────────────────────────────── BOUNDARY 3: Data ──────
                                   ┌───────────────▼───────────────────────┐
                                   │  SQLITE DATABASE                       │
                                   │  ✓ Docker volume (host filesystem)     │
                                   │  ✓ Not exposed to any external port    │
                                   │  ✓ Access only through EF Core within  │
                                   │    backend container process           │
                                   │  ✗ No encryption at rest (consider    │
                                   │    SQLCipher for high-sensitivity data)│
                                   └───────────────────────────────────────┘

  SECURITY CONTROLS SUMMARY:
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Control              │ Layer         │ Implementation                │
  │  ─────────────────────┼───────────────┼───────────────────────────── │
  │  TLS Encryption       │ Nginx         │ SSL cert (Let's Encrypt)      │
  │  Rate Limiting        │ Nginx + App   │ Nginx zones + custom MW       │
  │  Authentication       │ Backend       │ ASP.NET Identity + Cookies    │
  │  Authorisation        │ Backend       │ [Authorize(Roles = "Admin")]  │
  │  CSRF Protection      │ Backend       │ SameSite=None + HTTPS-only    │
  │  XSS Prevention       │ Backend/Nginx │ CSP, X-XSS-Protection header │
  │  Clickjacking         │ Nginx/App     │ X-Frame-Options: DENY         │
  │  SQL Injection        │ Backend       │ EF Core parameterised queries │
  │  Input Validation     │ Backend       │ Data annotations + ModelState │
  │  Secrets Management   │ Docker env    │ .env vars, never in code      │
  │  Audit Trail          │ Backend       │ AuditLog table + Serilog      │
  │  Request Tracking     │ Backend       │ ApiRequestLog per request     │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## 8. Deployment Topology

```
  ┌──────────────────────────────────────────────────────────────┐
  │  PRODUCTION HOST (Linux VPS / Cloud VM)                       │
  │                                                              │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  Docker Engine                                          │  │
  │  │                                                        │  │
  │  │  ┌────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
  │  │  │  slp-nginx │  │ slp-frontend │  │  slp-backend  │  │  │
  │  │  │            │  │              │  │               │  │  │
  │  │  │ :80  :443  │  │    :3000     │  │    :5062      │  │  │
  │  │  │            │  │              │  │               │  │  │
  │  │  │ nginx:1.25 │  │  Next.js 14  │  │ .NET Core 8   │  │  │
  │  │  │  -alpine   │  │  Node 20     │  │ Kestrel       │  │  │
  │  │  └─────┬──────┘  └──────┬───────┘  └───────┬───────┘  │  │
  │  │        │  slp-network    │                   │          │  │
  │  │        └─────────────────┴───────────────────┘          │  │
  │  │                                                        │  │
  │  │  ┌──────────────────────┐  ┌────────────────────────┐  │  │
  │  │  │  Volume: slp-data    │  │  Volume: slp-logs      │  │  │
  │  │  │  /app/data/          │  │  /app/logs/            │  │  │
  │  │  │  slpsystems.db       │  │  slpsystems-YYYY-MM-DD │  │  │
  │  │  │  (SQLite WAL)        │  │  .log (30-day rolling) │  │  │
  │  │  └──────────────────────┘  └────────────────────────┘  │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                              │
  │  Ports exposed to internet: 80 (HTTP), 443 (HTTPS)          │
  │  Ports internal only:       3000, 5062                       │
  └──────────────────────────────────────────────────────────────┘
```

### 8.1 Container Health Checks

| Container | Health Check Command | Interval | Retries |
|-----------|---------------------|----------|---------|
| slp-backend | `wget -qO- http://localhost:5062/api/health` | 30s | 3 |
| slp-frontend | `wget -qO- http://localhost:3000` | 30s | 3 |
| slp-nginx | (inherits host check) | — | — |

The health endpoint (`/api/health`) returns EF Core `DbContext` check status, uptime, and version.

### 8.2 Restart Policy

All containers use `restart: unless-stopped`, ensuring automatic recovery after a process crash or host reboot without requiring manual intervention.

---

## 9. Entity Relationship Overview

```
  AspNetUsers ──────────── AspNetUserRoles ──── AspNetRoles
       │ (IdentityUser)                              │
       │                                             │ "Admin", "Customer"
       │
       ├── AuditLog (userId FK)
       ├── ApiRequestLog (userId FK)
       └── ChatMessage (customerId optional FK)

  BlogCategory ──1:N── BlogPost
  Service (standalone)
  Testimonial (standalone)
  CaseStudy (standalone)
  TeamMember (standalone)
  ContactMessage (standalone)
  NewsletterSubscriber (standalone)
  VideoDemo (standalone)
  IndustrySolution (standalone)
  SiteSettings (singleton row)

  ChatRequest ──1:N── ChatMessage
                │         └── sessionId (groups messages)
                └── status: Pending / Active / Resolved

  JobPosting ──1:N── JobApplication

  All entities extend BaseEntity:
    Id (int, auto-increment PK)
    CreatedAt (DateTime, UTC, auto-set)
    UpdatedAt (DateTime, UTC, auto-set on save)
```

---

## 10. Non-Functional Requirements

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| Page Load (public) | < 2s LCP | SSR via Next.js App Router, Nginx gzip |
| API Response Time | < 200ms p95 | SQLite WAL, EF Core query optimization |
| API Rate Limit | 100 req/min per IP (app), 20 req/s (Nginx) | Dual-layer rate limiting |
| Uptime | 99.5% | Docker `restart: unless-stopped` |
| Log Retention | 30 days rolling | Serilog `retainedFileCountLimit: 30` |
| Audit Retention | 90 days | DataCleanupService background purge |
| Max Upload Size | 20 MB | Nginx `client_max_body_size` |
| Cookie Expiry | 8 hours sliding | `ExpireTimeSpan = 8h` + `SlidingExpiration` |
| Concurrent WebSocket | Hundreds per node | SignalR + Nginx WebSocket upgrade |
| DB Concurrent Reads | Unlimited | SQLite WAL mode |
| Security Headers | OWASP Top 10 mitigated | SecurityHeadersMiddleware + Nginx |

---

*Document maintained by the SLP Systems engineering team. Update this document whenever the system architecture changes materially.*
