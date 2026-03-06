# Software Architecture Document (SAD)
## SLP Systems Corporate Portal

**Document Version:** 1.0  
**Date:** 2026-03-03  
**Status:** Approved  
**Standard:** C4 Model (Level 1, 2, 3)  

---

## Table of Contents

1. [Architectural Goals and Constraints](#1-architectural-goals-and-constraints)
2. [System Context — C4 Level 1](#2-system-context--c4-level-1)
3. [Container Diagram — C4 Level 2](#3-container-diagram--c4-level-2)
4. [Component Diagram — C4 Level 3 (Backend)](#4-component-diagram--c4-level-3-backend)
5. [Component Diagram — C4 Level 3 (Frontend)](#5-component-diagram--c4-level-3-frontend)
6. [Key Architectural Patterns](#6-key-architectural-patterns)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
8. [Data Architecture](#8-data-architecture)
9. [API Design Specification](#9-api-design-specification)
10. [Dependency Map](#10-dependency-map)

---

## 1. Architectural Goals and Constraints

### 1.1 Architectural Goals

| Goal | Description | Achieved By |
|------|-------------|-------------|
| **Separation of Concerns** | UI, business logic, and data access must be cleanly separated and independently testable | Three-tier architecture: Controller → Service → Repository |
| **Maintainability** | Any developer familiar with .NET or Next.js can read and extend the code without confusion | Consistent patterns, no logic leakage between layers |
| **Security by Default** | Security controls apply automatically without requiring per-endpoint configuration | Middleware pipeline, [Authorize] defaults, HttpOnly cookies |
| **Operational Observability** | Every request must be traceable from Nginx log through to database query | Correlation IDs, Serilog structured logs, API request tracking |
| **Content Agility** | Non-technical administrators must be able to manage all website content without engineering involvement | Admin UI with Tiptap rich text editor |
| **Real-Time Capability** | Live chat must deliver messages in real time, not via polling | SignalR WebSocket hub |
| **Deployability** | The entire system must run from a single `docker compose up` command | Dockerised containers with health checks and dependency ordering |

### 1.2 Architectural Constraints

| Constraint | Reason | Impact |
|------------|--------|--------|
| Single-node deployment | No Kubernetes cluster provisioned; VPS hosting | SQLite is viable; no shared-state problems |
| SQLite database | Cost and simplicity for current scale | Multi-writer limitation; WAL mode mitigates read contention |
| No external authentication provider (Okta, Azure AD) | Self-contained deployment requirement | ASP.NET Core Identity manages all auth |
| Container images must be small | Reduce deployment time and storage | Alpine base images, multi-stage Docker builds |
| No CDN in current deployment | DNS not yet configured for CDN | Nginx serves static assets; Next.js handles image optimization |
| .NET 8 LTS required | Long-term support for production stability | EF Core 8, ASP.NET Core 8 |
| TypeScript-only frontend | Type safety, refactoring safety | No `.js` files in Next.js source |

### 1.3 Quality Attributes (ATAM)

| Attribute | Scenario | Architecture Response |
|-----------|----------|-----------------------|
| **Availability** | Backend process crashes at 2 AM | Docker `restart: unless-stopped` restarts within seconds |
| **Security** | Attacker submits 1000 requests/minute | Nginx rate zone (20 req/s) + app-level 100 req/min per IP |
| **Modifiability** | Add a new content type (e.g., "Events") | Add Entity → Migration → Repository → Service → Controller → Frontend pages |
| **Testability** | Test BlogService without a real database | Service depends on IUnitOfWork interface; mock in tests |
| **Performance** | 100 concurrent visitors to homepage | Next.js SSR with cache, Nginx gzip, SQLite WAL reads |
| **Observability** | Production error reported by user | Correlation ID in response → find full request trace in Serilog log |

---

## 2. System Context — C4 Level 1

The System Context diagram shows the SLP Systems Portal as a black box and all external users and systems that interact with it.

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                    C4 LEVEL 1 — SYSTEM CONTEXT                                      ║
║                    SLP Systems Corporate Portal                                      ║
╚══════════════════════════════════════════════════════════════════════════════════════╝

                                 ┌──────────────────────┐
                                 │  [Person]             │
                                 │  Public Website       │
                                 │  Visitor              │
                                 │                       │
                                 │  Reads content, sends │
                                 │  inquiries, applies   │
                                 │  for jobs, chats live │
                                 └──────────┬────────────┘
                                            │ Browses website
                                            │ (HTTPS)
                    ┌──────────────────────────────────────────────────┐
                    │                                                  │
   ┌────────────────▼────────────────┐    ┌─────────────────────────▼──────────────┐
   │  [Person]                       │    │                                         │
   │  Customer Portal User           │    │  [Software System]                      │
   │                                 │    │                                         │
   │  Registered customer; logs in   │    │     SLP Systems                         │
   │  to view their personalised     │◄──►│     Corporate Portal                    │
   │  dashboard and order history    │    │                                         │
   └─────────────────────────────────┘    │  Corporate website + CMS +              │
                                          │  live chat + job board +                │
   ┌─────────────────────────────────┐    │  admin dashboard                        │
   │  [Person]                       │    │                                         │
   │  SLP Administrator              │◄──►│                                         │
   │                                 │    └──────────────────┬──────────────────────┘
   │  Internal staff; manages all    │                       │
   │  content, responds to chats,    │                       │
   │  reviews messages, configures   │                       │
   │  site settings                  │                       │
   └─────────────────────────────────┘                       │ Sends transactional emails
                                                             │ (contact confirmations,
                                                             │  newsletter subscription,
                                                             │  job application notifications)
                                                             │
                                          ┌──────────────────▼──────────────────────┐
                                          │  [Software System]                       │
                                          │  SMTP Mail Server                        │
                                          │  (External)                              │
                                          │                                          │
                                          │  Configured via env: SMTP_HOST,         │
                                          │  SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD │
                                          │  Optional — contact form works without  │
                                          │  SMTP (messages saved to DB only)       │
                                          └─────────────────────────────────────────┘
```

---

## 3. Container Diagram — C4 Level 2

The Container diagram zooms into the SLP Systems Portal and shows the separately deployable units (containers) and their interactions.

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                    C4 LEVEL 2 — CONTAINER DIAGRAM                                        ║
║                    SLP Systems Corporate Portal                                           ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝

  External Actors:                  SLP Systems Portal (Docker Compose: slp-network)
  ─────────────────                 ─────────────────────────────────────────────────────────

  ┌──────────────────┐              ┌────────────────────────────────────────────────────────┐
  │  Public Visitor  │─── HTTPS ───►│                                                        │
  │  Admin User      │    :80/:443  │   ┌──────────────────────────────────────────────────┐ │
  │  Customer User   │              │   │  [Container: Reverse Proxy]                      │ │
  └──────────────────┘              │   │  Nginx 1.25-Alpine                                │ │
                                    │   │                                                  │ │
                                    │   │  - TLS termination                               │ │
                                    │   │  - Rate limiting (Nginx zones)                   │ │
                                    │   │  - Security headers                              │ │
                                    │   │  - Gzip compression                              │ │
                                    │   │  - WebSocket upgrade for /hubs/*                 │ │
                                    │   │  - Routing: /api/* and /hubs/* → Backend         │ │
                                    │   │             /*             → Frontend             │ │
                                    │   └───────────────┬──────────────────────────────────┘ │
                                    │                   │                                    │
                                    │         ┌─────────┴──────────┐                        │
                                    │         │                    │                        │
                                    │         │ :3000              │ :5062                  │
                                    │         ▼                    ▼                        │
                                    │   ┌──────────────┐   ┌─────────────────────────────┐  │
                                    │   │  [Container] │   │  [Container]                │  │
                                    │   │  Frontend    │   │  Backend API                │  │
                                    │   │              │   │                             │  │
                                    │   │  Next.js 14  │   │  ASP.NET Core 8             │  │
                                    │   │  React 18    │   │  Kestrel HTTP Server        │  │
                                    │   │  TypeScript  │   │  EF Core 8                  │  │
                                    │   │  Tailwind CSS│   │  ASP.NET Identity           │  │
                                    │   │  Tiptap v3   │   │  Serilog                    │  │
                                    │   │              │   │  SignalR                    │  │
                                    │   │  Renders HTML│   │                             │  │
                                    │   │  pages SSR.  │   │  Handles REST API requests  │  │
                                    │   │  Fetches API │   │  and WebSocket sessions.    │  │
                                    │   │  server-side │   │  Enforces authentication    │  │
                                    │   │  or client-  │   │  and authorisation.         │  │
                                    │   │  side.       │   │                             │  │
                                    │   │              │   │  Env: ASPNETCORE_ENVIRONMENT│  │
                                    │   │  Env:        │   │  ConnectionStrings__Default │  │
                                    │   │  NEXT_PUBLIC │   │  Admin__Email/Password      │  │
                                    │   │  _API_URL    │   │  Smtp__Host/Port/User/Pass  │  │
                                    │   └──────┬───────┘   └──────────────┬──────────────┘  │
                                    │          │                           │                 │
                                    │          │  HTTP fetch to /api/*     │ EF Core         │
                                    │          └─────────────►─────────────┘ (internal)     │
                                    │                                     │                 │
                                    │                                     │ :5062/hubs/chat  │
                                    │                 ◄─── WebSocket ─────┘ (SignalR)       │
                                    │                      (via Nginx)                      │
                                    │                                                        │
                                    │   ┌──────────────────────────────────────────────────┐ │
                                    │   │  [Container: Database]                           │ │
                                    │   │  SQLite — slpsystems.db                          │ │
                                    │   │                                                  │ │
                                    │   │  Embedded in Backend container process.          │ │
                                    │   │  WAL mode enabled.                               │ │
                                    │   │  Persisted via Docker volume: slp-data           │ │
                                    │   │  Mounted at: /app/data/slpsystems.db             │ │
                                    │   │                                                  │ │
                                    │   │  Stores: all application entities,               │ │
                                    │   │  ASP.NET Identity tables, migrations             │ │
                                    │   └──────────────────────────────────────────────────┘ │
                                    │                                                        │
                                    │   ┌──────────────────────────────────────────────────┐ │
                                    │   │  [Volume: slp-logs]                              │ │
                                    │   │  Serilog rolling log files                       │ │
                                    │   │  slpsystems-YYYY-MM-DD.log                       │ │
                                    │   │  Retained for 30 days                            │ │
                                    │   │  Shared between backend and nginx containers     │ │
                                    │   └──────────────────────────────────────────────────┘ │
                                    └────────────────────────────────────────────────────────┘

  External System:
  ┌────────────────────────────────────┐
  │  SMTP Mail Server (External)       │
  │  Backend → EmailService →          │
  │  SmtpClient → SMTP_HOST:SMTP_PORT  │
  └────────────────────────────────────┘
```

### 3.1 Container Technology Summary

| Container | Base Image | Language | Framework | Port |
|-----------|-----------|----------|-----------|------|
| slp-nginx | `nginx:1.25-alpine` | — | Nginx | 80, 443 |
| slp-frontend | `node:20-alpine` (multi-stage) | TypeScript | Next.js 14 | 3000 |
| slp-backend | `mcr.microsoft.com/dotnet/aspnet:8.0` | C# | ASP.NET Core 8 | 5062 |

---

## 4. Component Diagram — C4 Level 3 (Backend)

This diagram shows the internal components of the Backend API container and how they collaborate to handle a request.

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                    C4 LEVEL 3 — COMPONENT DIAGRAM (Backend API Container)                ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝

  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │  Backend API Container — ASP.NET Core 8                                                │
  │                                                                                        │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  MIDDLEWARE PIPELINE (Program.cs — ordered)                                      │  │
  │  │                                                                                  │  │
  │  │  [1] ResponseCompressionMiddleware  — GZip for eligible responses                │  │
  │  │  [2] HstsMiddleware                 — HSTS in production                         │  │
  │  │  [3] CorrelationIdMiddleware        — Generate/propagate X-Correlation-Id        │  │
  │  │  [4] GlobalExceptionMiddleware      — Catch all → error envelope JSON response   │  │
  │  │  [5] SecurityHeadersMiddleware      — X-Frame-Options, X-XSS-Protection, etc.   │  │
  │  │  [6] RateLimitingMiddleware         — Per-IP sliding window (100 req/60s)        │  │
  │  │  [7] HttpsRedirectionMiddleware     — Redirect HTTP → HTTPS                      │  │
  │  │  [8] StaticFilesMiddleware          — Serve wwwroot                               │  │
  │  │  [9] RoutingMiddleware              — Match routes                                │  │
  │  │  [10] CorsMiddleware                — Allow Next.js origins only                  │  │
  │  │  [11] AuthenticationMiddleware      — Read cookie → ClaimsPrincipal              │  │
  │  │  [12] AuthorizationMiddleware       — Enforce [Authorize] attributes             │  │
  │  │  [13] ApiRequestTrackingMiddleware  — Log to ApiRequestLogs table               │  │
  │  │  [14] SerilogRequestLoggingMiddleware — Structured HTTP log line                │  │
  │  └──────────────────────────────────────────────────────────────────────────────────┘  │
  │                                           │                                            │
  │                                           ▼                                            │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  CONTROLLERS (api/Controllers/)                                                  │  │
  │  │                                                                                  │  │
  │  │  [ApiController] on all — automatic 400 on ModelState failure                   │  │
  │  │                                                                                  │  │
  │  │  AuthController         POST /api/auth/login, /logout, GET /me, /check          │  │
  │  │  BlogController         GET/POST/PUT/DELETE /api/blog                           │  │
  │  │  ServicesController     GET/POST/PUT/DELETE /api/services                       │  │
  │  │  CaseStudiesController  GET/POST/PUT/DELETE /api/case-studies                   │  │
  │  │  IndustriesController   GET/POST/PUT/DELETE /api/industries                     │  │
  │  │  TeamController         GET/POST/PUT/DELETE /api/team                           │  │
  │  │  TestimonialsController GET/POST/PUT/DELETE /api/testimonials                   │  │
  │  │  VideosController       GET/POST/PUT/DELETE /api/videos                         │  │
  │  │  ContactController      POST /api/contact, GET (admin)                          │  │
  │  │  NewsletterController   POST /api/newsletter, GET/DELETE (admin)                │  │
  │  │  JobsController         GET/POST/PUT/DELETE /api/jobs, POST /api/jobs/apply     │  │
  │  │  LiveChatController     GET /api/chat (admin), GET /api/chat/sessions           │  │
  │  │  ChatRequestsController GET/POST /api/chat-requests                             │  │
  │  │  UsersController        GET/POST/PUT/DELETE /api/users (admin)                  │  │
  │  │  AdminDashboardController GET /api/admin/dashboard                              │  │
  │  │  AdminMonitoringController GET /api/admin/monitoring/*                          │  │
  │  │  HomeController         GET /api/home (public homepage data)                    │  │
  │  └────────────────────────────────┬─────────────────────────────────────────────────┘  │
  │                                   │  Inject via constructor DI                         │
  │                                   ▼                                                    │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  SERVICES (Services/Implementations/)                                            │  │
  │  │                                                                                  │  │
  │  │  IBlogService → BlogService                                                      │  │
  │  │    GetPublishedPostsAsync(offset, limit, categorySlug, tag)                      │  │
  │  │    GetPostBySlugAsync(slug)                                                      │  │
  │  │    CreatePostAsync(dto) / UpdatePostAsync(id, dto) / DeletePostAsync(id)         │  │
  │  │                                                                                  │  │
  │  │  IContactService → ContactService                                                │  │
  │  │    SubmitInquiryAsync(dto) → save DB + send notification email                  │  │
  │  │    GetAllAsync() / UpdateStatusAsync(id, status)                                 │  │
  │  │                                                                                  │  │
  │  │  INewsletterService → NewsletterService                                          │  │
  │  │    SubscribeAsync(email) → deduplicate + send confirmation email                │  │
  │  │    UnsubscribeAsync(email) / GetAllAsync()                                       │  │
  │  │                                                                                  │  │
  │  │  IEmailService → EmailService                                                    │  │
  │  │    SendAsync(to, subject, htmlBody) → SMTP via SmtpClient                       │  │
  │  │    Graceful failure — logs error, does not crash request                        │  │
  │  │                                                                                  │  │
  │  │  ISiteService → SiteService                                                      │  │
  │  │    GetSettingsAsync() / UpdateSettingsAsync(dto)                                 │  │
  │  │    GetHomePageDataAsync() → aggregates multiple repos in one call               │  │
  │  │                                                                                  │  │
  │  │  DataCleanupService (IHostedService — background)                                │  │
  │  │    Runs on schedule: purge AuditLogs > 90 days, ApiRequestLogs > 30 days        │  │
  │  └────────────────────────────────┬─────────────────────────────────────────────────┘  │
  │                                   │  Inject IUnitOfWork via constructor               │
  │                                   ▼                                                    │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  UNIT OF WORK (Repositories/Implementations/UnitOfWork.cs)                      │  │
  │  │                                                                                  │  │
  │  │  IUnitOfWork → UnitOfWork                                                        │  │
  │  │    Lazy-instantiates repositories sharing one ApplicationDbContext               │  │
  │  │    SaveChangesAsync() → calls DbContext.SaveChangesAsync() once                 │  │
  │  │    Dispose() → calls DbContext.Dispose()                                         │  │
  │  │                                                                                  │  │
  │  │  Repositories (all extend Repository<T> base):                                  │  │
  │  │  ├── IBlogRepository         → BlogRepository                                   │  │
  │  │  ├── IServiceRepository      → ServiceRepository                                │  │
  │  │  ├── ICaseStudyRepository    → CaseStudyRepository                              │  │
  │  │  ├── IContactRepository      → ContactRepository                                │  │
  │  │  ├── INewsletterRepository   → NewsletterRepository                             │  │
  │  │  ├── ITeamMemberRepository   → TeamMemberRepository                             │  │
  │  │  ├── ITestimonialRepository  → TestimonialRepository                            │  │
  │  │  ├── IIndustrySolutionRepository → IndustrySolutionRepository                   │  │
  │  │  ├── IVideoDemoRepository    → VideoDemoRepository                              │  │
  │  │  ├── ISiteSettingsRepository → SiteSettingsRepository                           │  │
  │  │  ├── IChatRequestRepository  → ChatRequestRepository                            │  │
  │  │  ├── IChatMessageRepository  → ChatMessageRepository                            │  │
  │  │  ├── IAuditLogRepository     → AuditLogRepository                               │  │
  │  │  └── (JobPostings via DbContext direct in JobsController — to be extracted)     │  │
  │  └────────────────────────────────┬─────────────────────────────────────────────────┘  │
  │                                   │                                                    │
  │                                   ▼                                                    │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  DATA ACCESS (Data/)                                                             │  │
  │  │                                                                                  │  │
  │  │  ApplicationDbContext : IdentityDbContext<IdentityUser>                          │  │
  │  │    - Inherits all ASP.NET Identity tables (AspNetUsers, Roles, Claims, etc.)    │  │
  │  │    - DbSet<> for every application entity                                       │  │
  │  │    - OnModelCreating: unique indexes on all Slug columns                        │  │
  │  │    - Auto-sets CreatedAt / UpdatedAt via SaveChangesAsync override              │  │
  │  │                                                                                  │  │
  │  │  SeedData.InitializeAsync()                                                      │  │
  │  │    - Run on startup: creates Admin role, seeds admin user from env vars         │  │
  │  │    - Idempotent: checks existence before creating                               │  │
  │  └────────────────────────────────┬─────────────────────────────────────────────────┘  │
  │                                   │  EF Core 8 → SQLite provider                      │
  │                                   ▼                                                    │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  SignalR Hub (Hubs/ChatHub.cs)                                                   │  │
  │  │                                                                                  │  │
  │  │  ChatHub : Hub                                                                   │  │
  │  │    JoinSession(sessionId, name, email)   → group "session-{id}"                 │  │
  │  │    JoinAdminRoom()                        → group "admins"                       │  │
  │  │    SendMessage(sessionId, name, ...)      → saves to DB, notifies "admins"       │  │
  │  │    AdminReply(sessionId, adminName, ...)  → saves to DB, notifies session group  │  │
  │  │    MarkRead(sessionId)                    → updates IsRead in ChatMessages       │  │
  │  │                                                                                  │  │
  │  │  Mapped to: /hubs/chat                                                           │  │
  │  │  Injects: IUnitOfWork, ILogger<ChatHub>                                         │  │
  │  └──────────────────────────────────────────────────────────────────────────────────┘  │
  │                                                                                        │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  EXCEPTION HIERARCHY (Exceptions/)                                               │  │
  │  │                                                                                  │  │
  │  │  AppException (base)                                                             │  │
  │  │  ├── NotFoundException      (404)  error_code: NOT_FOUND                        │  │
  │  │  ├── ValidationException    (400)  error_code: VALIDATION_ERROR                 │  │
  │  │  ├── UnauthorizedException  (401)  error_code: UNAUTHORIZED                     │  │
  │  │  └── ConflictException      (409)  error_code: CONFLICT                         │  │
  │  │                                                                                  │  │
  │  │  All caught by GlobalExceptionMiddleware → consistent error envelope:           │  │
  │  │  { "detail": "...", "error_code": "...", "correlation_id": "..." }              │  │
  │  └──────────────────────────────────────────────────────────────────────────────────┘  │
  │                                                                                        │
  └────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                              EF Core → SQLite driver
                                           │
                                           ▼
                               SQLite — slpsystems.db
```

---

## 5. Component Diagram — C4 Level 3 (Frontend)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                    C4 LEVEL 3 — COMPONENT DIAGRAM (Frontend Container)                   ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝

  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │  Frontend Container — Next.js 14 (App Router)                                          │
  │                                                                                        │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  APP ROUTER (src/app/)                                                           │  │
  │  │                                                                                  │  │
  │  │  PUBLIC ROUTES (Server Components — SSR, SEO-optimised)                         │  │
  │  │  /                    → Homepage (services, testimonials, blog preview)          │  │
  │  │  /about               → About page (team, company info)                          │  │
  │  │  /services            → Services listing                                         │  │
  │  │  /services/[slug]     → Service detail page                                      │  │
  │  │  /blog                → Blog listing with pagination                              │  │
  │  │  /blog/[slug]         → Blog post detail                                          │  │
  │  │  /industries          → Industry solutions overview                               │  │
  │  │  /industries/[slug]   → Industry detail page                                      │  │
  │  │  /careers             → Job listing                                               │  │
  │  │  /careers/[id]        → Job detail + application form                            │  │
  │  │  /contact             → Contact form                                              │  │
  │  │                                                                                  │  │
  │  │  CUSTOMER ROUTES (authenticated customers)                                       │  │
  │  │  /customer/login      → Customer login page                                      │  │
  │  │  /customer/dashboard  → Customer dashboard                                       │  │
  │  │  /customer/blog       → Customer-specific blog content                           │  │
  │  │                                                                                  │  │
  │  │  ADMIN ROUTES (require admin authentication cookie)                              │  │
  │  │  /admin               → Dashboard overview                                       │  │
  │  │  /admin/blog          → Blog post management                                     │  │
  │  │  /admin/services      → Service card management                                  │  │
  │  │  /admin/casestudies   → Case study management                                    │  │
  │  │  /admin/team          → Team member management                                   │  │
  │  │  /admin/industries    → Industry content management                              │  │
  │  │  /admin/testimonials  → Testimonial moderation                                   │  │
  │  │  /admin/messages      → Contact message inbox                                    │  │
  │  │  /admin/newsletter    → Newsletter subscriber management                         │  │
  │  │  /admin/jobs          → Job posting management                                   │  │
  │  │  /admin/live-chat     → Real-time live chat console                              │  │
  │  │  /admin/chat-requests → Chat request history                                     │  │
  │  │  /admin/settings      → Site settings configuration                              │  │
  │  │  /admin/audit         → Audit log viewer                                         │  │
  │  │  /admin/api-tracking  → API request log viewer                                   │  │
  │  │  /admin/health        → System health status                                     │  │
  │  │  /admin/logs          → Application log viewer                                   │  │
  │  └──────────────────────────────────────────────────────────────────────────────────┘  │
  │                                                                                        │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  KEY COMPONENTS (Client Components — interactivity)                              │  │
  │  │                                                                                  │  │
  │  │  TiptapEditor                                                                    │  │
  │  │    - Wraps @tiptap/react + @tiptap/starter-kit + @tiptap/extension-placeholder  │  │
  │  │    - Rich text editor for blog posts, service descriptions, case studies         │  │
  │  │    - Outputs HTML string stored in DB                                            │  │
  │  │                                                                                  │  │
  │  │  LiveChatWidget (public)                                                         │  │
  │  │    - Floating chat button on public pages                                        │  │
  │  │    - Uses @microsoft/signalr to connect to /hubs/chat                           │  │
  │  │    - Manages session ID (localStorage or cookie)                                 │  │
  │  │    - Calls hub: JoinSession(), SendMessage()                                     │  │
  │  │    - Listens for: ReceiveMessage                                                 │  │
  │  │                                                                                  │  │
  │  │  AdminLiveChatConsole (/admin/live-chat)                                         │  │
  │  │    - Uses @microsoft/signalr to connect to /hubs/chat                           │  │
  │  │    - Calls hub: JoinAdminRoom(), AdminReply(), MarkRead()                        │  │
  │  │    - Listens for: CustomerConnected, ReceiveMessage                              │  │
  │  │    - Shows list of active sessions on left, conversation on right               │  │
  │  │                                                                                  │  │
  │  │  AdminLayout (admin/layout.tsx)                                                  │  │
  │  │    - Shared sidebar navigation for all /admin/* pages                           │  │
  │  │    - Reads auth state: redirects to /auth/login if no valid session             │  │
  │  │                                                                                  │  │
  │  │  DataTable components (admin pages)                                              │  │
  │  │    - Pagination controls (offset/limit URL params)                               │  │
  │  │    - Inline status update buttons                                                │  │
  │  │    - Confirm-before-delete dialogs                                               │  │
  │  └──────────────────────────────────────────────────────────────────────────────────┘  │
  │                                                                                        │
  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
  │  │  API CLIENT PATTERN                                                              │  │
  │  │                                                                                  │  │
  │  │  Server Components:                                                              │  │
  │  │    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/blog`, {                       │  │
  │  │      next: { revalidate: 60 }  ← ISR caching                                   │  │
  │  │    })                                                                            │  │
  │  │                                                                                  │  │
  │  │  Client Components (admin mutations):                                            │  │
  │  │    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/blog`, {                       │  │
  │  │      method: "POST",                                                             │  │
  │  │      credentials: "include",   ← send cookie                                    │  │
  │  │      headers: { "Content-Type": "application/json" },                           │  │
  │  │      body: JSON.stringify(data)                                                  │  │
  │  │    })                                                                            │  │
  │  └──────────────────────────────────────────────────────────────────────────────────┘  │
  │                                                                                        │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Key Architectural Patterns

### 6.1 Repository Pattern

Every database entity group has a dedicated repository interface and implementation. No SQL or EF Core LINQ queries exist outside repository classes.

```
Interface (contract):          Implementation (EF Core LINQ):

IBlogRepository                BlogRepository : Repository<BlogPost>, IBlogRepository
  GetBySlugAsync(slug)           → _context.BlogPosts.FirstOrDefaultAsync(p => p.Slug == slug)
  GetPublishedAsync(offset,lim)  → _context.BlogPosts.Where(p => p.IsPublished)
  GetByCategory(categorySlug)    →     .OrderByDescending(p => p.PublishedAt)
  ...                            →     .Skip(offset).Take(limit).ToListAsync()

Repository<T> base class:
  AddAsync(T entity)             → _context.Set<T>().AddAsync(entity)
  UpdateAsync(T entity)          → _context.Set<T>().Update(entity)
  DeleteAsync(int id)            → find + _context.Set<T>().Remove()
  GetByIdAsync(int id)           → _context.Set<T>().FindAsync(id)
  GetAllAsync()                  → _context.Set<T>().ToListAsync()
```

**Benefit**: Switching from SQLite to PostgreSQL requires only changing the EF Core provider in `Program.cs`. All repository implementations remain unchanged because they use LINQ, not raw SQL.

### 6.2 Unit of Work Pattern

A single `IUnitOfWork` instance per HTTP request scope wraps all repositories and shares one `ApplicationDbContext`. This ensures:

```
// Before Unit of Work (problematic):
var blogRepo = new BlogRepository(new ApplicationDbContext(...));  // context 1
var auditRepo = new AuditLogRepository(new ApplicationDbContext(...)); // context 2
// Two separate transaction scopes — partial failure leaves data inconsistent

// With Unit of Work (correct):
// One IUnitOfWork injected by DI — one DbContext — one transaction scope
_uow.Blog.AddAsync(post);           // uses shared _context
_uow.AuditLogs.AddAsync(auditEntry); // same shared _context
await _uow.SaveChangesAsync();       // ONE commit — atomic
```

The `UnitOfWork` class lazily initialises each repository using the null-coalescing assignment pattern:

```csharp
public IBlogRepository Blog =>
    _blog ??= new BlogRepository(_context);
```

This means only repositories actually accessed within a request are instantiated.

### 6.3 Service Layer Pattern

Services sit between controllers and repositories. They contain business logic that would be inappropriate in a controller (HTTP concerns) or a repository (pure data access).

```
Controller responsibility:
  - Parse HTTP request, validate model state
  - Call service method
  - Return HTTP response (200, 201, 404)
  - Never: contains business logic, calls repository directly

Service responsibility:
  - Enforce business rules ("a blog post can only be published if it has a slug")
  - Orchestrate multiple repository calls
  - Call external services (EmailService)
  - Write audit log entries
  - Never: returns HTTPException, knows about HTTP status codes

Repository responsibility:
  - Execute EF Core queries against the database
  - Return domain entities or DTOs
  - Never: contains business logic, calls other repositories
```

Example flow for newsletter subscription:

```
NewsletterController.Subscribe(dto)
  │ Validates email format via [EmailAddress]
  │ Returns 400 if invalid
  ▼
NewsletterService.SubscribeAsync(email)
  │ Checks: _uow.Newsletter.ExistsByEmailAsync(email)
  │ If exists and already confirmed → throw ConflictException (409)
  │ If exists and not confirmed → resend confirmation
  │ If new → _uow.Newsletter.AddAsync(new NewsletterSubscriber)
  │ _emailService.SendConfirmationAsync(email)  [non-blocking, failure logged]
  │ await _uow.SaveChangesAsync()
  ▼
Controller returns 201 Created
```

### 6.4 Role-Based Access Control (RBAC)

The system defines two roles seeded at startup:

| Role | Access | Seed Mechanism |
|------|--------|---------------|
| `Admin` | All admin API endpoints, admin dashboard, all content management | `SeedData.InitializeAsync()` — creates role + admin user from env vars |
| `Customer` | Customer portal endpoints (`/customer/*`) | Assigned on customer registration |

Authorization is enforced declaratively:

```csharp
// Public — no attribute
[HttpGet("api/blog")]
public async Task<IActionResult> GetPosts() { ... }

// Admin only
[Authorize(Roles = "Admin")]
[HttpPost("api/blog")]
public async Task<IActionResult> CreatePost([FromBody] CreateBlogPostRequest dto) { ... }

// Any authenticated user
[Authorize]
[HttpGet("api/auth/me")]
public IActionResult GetCurrentUser() { ... }
```

Unauthorized access returns `401 Unauthorized` (not a redirect) because `OnRedirectToLogin` is overridden in cookie config:

```csharp
options.Events.OnRedirectToLogin = context =>
{
    context.Response.StatusCode = 401;
    return Task.CompletedTask;
};
```

---

## 7. Cross-Cutting Concerns

### 7.1 Structured Logging (Serilog)

Every log entry includes:

| Field | Source | Example |
|-------|--------|---------|
| `Timestamp` | Serilog | `2026-03-03 14:22:01.123 +00:00` |
| `Level` | Serilog | `[INF]`, `[WRN]`, `[ERR]` |
| `CorrelationId` | `CorrelationIdMiddleware` | `a3f1c8e2...` |
| `Message` | Logger call | `Blog post created: my-new-post` |
| `Exception` | Catch block | Full stack trace on error |
| `MachineName` | Serilog enricher | `slp-backend` |
| `ThreadId` | Serilog enricher | `12` |

Log output template (file):

```
{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {CorrelationId} {Message:lj}{NewLine}{Exception}
```

Log rotation: daily rolling files, retained for 30 days, stored in Docker volume `slp-logs`.

Noisy namespaces suppressed to `Warning`:

```json
"Override": {
  "Microsoft": "Warning",
  "Microsoft.AspNetCore": "Warning",
  "Microsoft.EntityFrameworkCore": "Warning",
  "System": "Warning"
}
```

### 7.2 Error Handling

The `GlobalExceptionMiddleware` wraps the entire request pipeline in a try/catch. Every unhandled exception is mapped to a consistent error envelope:

```json
{
  "detail": "Human-readable message",
  "error_code": "VALIDATION_ERROR",
  "correlation_id": "a3f1c8e2b4d6...",
  "errors": { "Email": ["Email is required"] }
}
```

Exception-to-status-code mapping:

| Exception Type | HTTP Status | Error Code |
|---------------|-------------|------------|
| `AppException` (base) | `appEx.StatusCode` | `appEx.ErrorCode` |
| `NotFoundException` | 404 | `NOT_FOUND` |
| `ValidationException` | 400 | `VALIDATION_ERROR` |
| `UnauthorizedException` | 401 | `UNAUTHORIZED` |
| `ConflictException` | 409 | `CONFLICT` |
| `KeyNotFoundException` | 404 | `NOT_FOUND` |
| `UnauthorizedAccessException` | 401 | `UNAUTHORIZED` |
| `OperationCanceledException` | 499 | `REQUEST_CANCELLED` |
| Any other `Exception` | 500 | `INTERNAL_ERROR` |

### 7.3 Security Headers

Applied by `SecurityHeadersMiddleware` to every response:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

Additional headers applied at Nginx level:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

### 7.4 Rate Limiting (Dual Layer)

**Nginx layer** (first line of defence — per-connection):

| Zone | Rate | Burst | Applies To |
|------|------|-------|------------|
| `api` | 20 req/s | 40 | `/api/*` |
| `general` | 50 req/s | 100 | `/*` |

**Application layer** (per-IP sliding window):

```
Default: 100 requests per 60-second window per IP
Configurable: RateLimit__MaxRequests env var
Response: 429 Too Many Requests
          Header: Retry-After: 60
          Body: { "detail": "Too many requests.", "error_code": "RATE_LIMIT_EXCEEDED" }
```

### 7.5 Correlation ID Propagation

```
Request arrives:
  If X-Correlation-Id header present → use it
  Else → generate new GUID (compact format, no hyphens)

Actions:
  context.Items["CorrelationId"] = correlationId   ← available in all middleware
  context.Response.Headers["X-Correlation-Id"] = correlationId  ← returned to client
  LogContext.PushProperty("CorrelationId", correlationId)  ← in all Serilog entries

Error responses include:
  { ..., "correlation_id": "a3f1c8e2b4d6..." }
```

This allows a support engineer to take a `correlation_id` from a user-reported error and search the log file to find the full request trace.

### 7.6 API Request Tracking

Every API request is recorded in the `ApiRequestLogs` table by `ApiRequestTrackingMiddleware`:

| Column | Value |
|--------|-------|
| `Method` | `GET`, `POST`, etc. |
| `Path` | `/api/blog` |
| `StatusCode` | `200` |
| `DurationMs` | `45` |
| `ClientIp` | `203.0.113.5` |
| `UserId` | User ID (if authenticated) |
| `CorrelationId` | Correlation ID |
| `UserAgent` | Browser user agent |
| `CreatedAt` | UTC timestamp |

This data is visible in the admin dashboard under `/admin/api-tracking`.

---

## 8. Data Architecture

### 8.1 Entity Model

All entities extend `BaseEntity`:

```csharp
public abstract class BaseEntity
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

`ApplicationDbContext` overrides `SaveChangesAsync` to auto-set `UpdatedAt = DateTime.UtcNow` on every save.

### 8.2 Migration Strategy

EF Core Code-First migrations are used:

```
Migrations/
  20260225060615_InitialCreate              ← Core tables: Services, Blog, etc.
  20260225064538_AddAuditAndApiTracking     ← AuditLog, ApiRequestLog tables
  20260225150011_AddBlogCategoryDescription ← Added Description column to BlogCategory
  20260303162754_AddChatMessages            ← ChatMessage table for SignalR
  20260303171535_AddJobPostings             ← JobPosting, JobApplication tables
```

Migrations run automatically on startup via `Database.MigrateAsync()` (called inside `SeedData.InitializeAsync`). This is safe for SQLite — EF Core handles applying only unapplied migrations.

### 8.3 SQLite Configuration

```csharp
// WAL mode via EF Core model annotation
builder.HasAnnotation("Sqlite:WalMode", true);
```

WAL mode allows concurrent reads while a write transaction is in progress, which is important for a web application where reads vastly outnumber writes.

### 8.4 Data Retention Policy

| Data Type | Retention | Mechanism |
|-----------|-----------|-----------|
| `AuditLog` | 90 days | `DataCleanupService` background purge |
| `ApiRequestLog` | 30 days | `DataCleanupService` background purge |
| `BlogPost` | Indefinite | Manual admin deletion |
| `ContactMessage` | Indefinite (soft-delete) | Status field: New / Read / Archived |
| `ChatMessage` | Indefinite | Manual cleanup planned |
| Log files (Serilog) | 30 days | `retainedFileCountLimit: 30` rolling |

---

## 9. API Design Specification

### 9.1 Conventions

| Convention | Rule |
|------------|------|
| Base path | `/api/` |
| Versioning | Not yet versioned — planned `/api/v1/` prefix |
| Auth | Cookie (`credentials: "include"`) for admin; anonymous for public |
| Pagination | `?offset=0&limit=20` query params on all list endpoints |
| Error format | `{ detail, error_code, correlation_id }` — always |
| Dates | ISO 8601 UTC strings (`2026-03-03T14:22:01.000Z`) |
| Naming | camelCase JSON (configured via `JsonNamingPolicy.CamelCase`) |
| Null fields | Omitted in response (`JsonIgnoreCondition.WhenWritingNull`) |
| Circular refs | Ignored (`ReferenceHandler.IgnoreCycles`) |

### 9.2 Key Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Cookie login |
| POST | `/api/auth/logout` | Auth | Clear cookie |
| GET | `/api/auth/me` | Auth | Current user info |
| GET | `/api/blog` | Public | Paginated blog list |
| GET | `/api/blog/{slug}` | Public | Blog post by slug |
| POST | `/api/blog` | Admin | Create post |
| PUT | `/api/blog/{id}` | Admin | Update post |
| DELETE | `/api/blog/{id}` | Admin | Delete post |
| GET | `/api/services` | Public | All services |
| POST | `/api/contact` | Public | Submit inquiry |
| POST | `/api/newsletter/subscribe` | Public | Subscribe |
| GET | `/api/jobs` | Public | Job listings |
| POST | `/api/jobs/{id}/apply` | Public | Submit application |
| GET | `/api/admin/dashboard` | Admin | Dashboard stats |
| GET | `/api/health` | Public | Health check + DB status |
| WS | `/hubs/chat` | Public+Admin | SignalR hub |

### 9.3 Swagger Documentation

Available in development at `http://localhost:5062/swagger`. Documents all endpoints with request/response schemas. Disabled in production (controlled by `app.Environment.IsDevelopment()` gate).

---

## 10. Dependency Map

```
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  DEPENDENCY FLOW (arrows = "depends on")                                     │
  │                                                                              │
  │                                                                              │
  │  Controllers ──────────────────────────────────────────►  IUnitOfWork       │
  │       │                                                          │           │
  │       │                                                          ▼           │
  │       └──────────────────────►  IService(s)              Repositories       │
  │                                       │                          │           │
  │                                       ├──────────────►  IUnitOfWork         │
  │                                       │                          │           │
  │                                       └──────────────►  IEmailService       │
  │                                                                  │           │
  │                                                          SmtpClient          │
  │                                                          (SMTP server)       │
  │                                                                              │
  │  IUnitOfWork ──────────────────────────────────────────►  ApplicationDbContext
  │                                                                  │           │
  │  ApplicationDbContext ─────────────────────────────────►  SQLite DB         │
  │                                                                              │
  │  ChatHub ──────────────────────────────────────────────►  IUnitOfWork       │
  │                                                                              │
  │  ALL above resolved via ASP.NET Core DI Container                           │
  │  (AddScoped lifetime — one instance per HTTP request)                        │
  │                                                                              │
  │  DI Registration (Program.cs):                                              │
  │    builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();                   │
  │    builder.Services.AddScoped<IBlogService, BlogService>();                  │
  │    builder.Services.AddScoped<IContactService, ContactService>();            │
  │    builder.Services.AddScoped<INewsletterService, NewsletterService>();      │
  │    builder.Services.AddScoped<IEmailService, EmailService>();                │
  │    builder.Services.AddScoped<ISiteService, SiteService>();                  │
  │    builder.Services.AddHostedService<DataCleanupService>();                  │
  └──────────────────────────────────────────────────────────────────────────────┘
```

---

*This document is the authoritative reference for the SLP Systems Portal software architecture. It must be kept in sync with the codebase. When a significant architectural change is made, add an ADR to `ADR.md` and update the relevant sections of this document.*
