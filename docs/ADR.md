# Architecture Decision Records (ADR)
## SLP Systems Corporate Portal

**Document Version:** 1.0  
**Date:** 2026-03-03  
**Format:** Lightweight ADR (Nygard style)  

---

> Architecture Decision Records document significant architectural decisions made during the design and development of the SLP Systems Portal. Each ADR captures the context, the decision, and the consequences — both positive and negative — so that future engineers understand not just what was decided, but why.

---

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](#adr-001-nextjs-14-app-router) | Next.js 14 App Router | Accepted | 2026-02-20 |
| [ADR-002](#adr-002-aspnet-core-8-web-api) | ASP.NET Core 8 Web API | Accepted | 2026-02-20 |
| [ADR-003](#adr-003-sqlite-as-primary-database) | SQLite as Primary Database | Accepted | 2026-02-20 |
| [ADR-004](#adr-004-signalr-for-real-time-chat) | SignalR for Real-Time Chat | Accepted | 2026-02-25 |
| [ADR-005](#adr-005-cookie-authentication) | Cookie Authentication | Accepted | 2026-02-20 |
| [ADR-006](#adr-006-repository--unit-of-work-pattern) | Repository + Unit of Work Pattern | Accepted | 2026-02-22 |
| [ADR-007](#adr-007-nginx-as-reverse-proxy) | Nginx as Reverse Proxy | Accepted | 2026-02-20 |
| [ADR-008](#adr-008-tiptap-rich-text-editor) | Tiptap Rich Text Editor | Accepted | 2026-02-24 |

---

## ADR-001: Next.js 14 App Router

**Status:** Accepted  
**Date:** 2026-02-20  
**Deciders:** SLP Systems Engineering Team  

---

### Context

The SLP Systems Portal requires a frontend framework that can:

1. Deliver excellent SEO for all public-facing content pages (blog, services, case studies, industry solutions) so they are indexed correctly by search engines.
2. Support a complex admin dashboard with real-time data, forms, and rich text editing that requires full client-side interactivity.
3. Integrate cleanly with a .NET backend REST API and a SignalR WebSocket endpoint.
4. Allow both server-rendered public pages and client-only admin pages within a single codebase.
5. Be productioninable in a Docker container.

The choices evaluated were:

| Option | SSR | SEO | TypeScript | Bundle Size | Docker |
|--------|-----|-----|------------|-------------|--------|
| Next.js 14 (App Router) | Yes (RSC) | Excellent | First-class | Small (RSC reduces JS) | Yes |
| Next.js 14 (Pages Router) | Yes | Excellent | First-class | Larger | Yes |
| React (Vite SPA) | No (CSR only) | Poor without extra work | Yes | Medium | Yes |
| Remix | Yes | Excellent | Yes | Small | Yes |
| Nuxt 3 (Vue) | Yes | Excellent | Yes | Medium | Yes |
| Angular Universal | Yes | Good | Yes | Large | Yes |

**App Router vs Pages Router specifically:**

The Next.js App Router (introduced in Next.js 13, stable in 14) introduces React Server Components (RSC), which fundamentally changes how data fetching works:

- **Pages Router**: Every page uses `getServerSideProps` or `getStaticProps` — data fetching is co-located in page-level functions. Client components and server rendering are entangled.
- **App Router**: Components are server-first by default. `fetch()` calls inside a server component execute on the server. Client components are opted into with `"use client"`. This enables fine-grained control over what JavaScript is shipped to the browser.

### Decision

Use **Next.js 14 with the App Router** and React Server Components.

Public-facing pages (blog, services, case studies, homepage) are implemented as Server Components that fetch data from the .NET API at render time on the server. This produces fully rendered HTML, which is optimal for SEO and Time to First Byte.

Admin pages that require interactivity (forms, live chat console, Tiptap editor) use Client Components (`"use client"`) because they depend on browser APIs and event handlers.

The TypeScript configuration is strict throughout the frontend (`strict: true` in `tsconfig.json`). Tailwind CSS provides utility-first styling without requiring a design system runtime dependency.

### Consequences

**Positive:**

- Public content pages produce complete HTML with meta tags, making them fully indexable by Google and other search engines. This directly supports SLP Systems' organic search goals.
- React Server Components reduce the client-side JavaScript bundle because data fetching logic stays on the server. Visitors with slow connections receive a faster page.
- The App Router co-locates layouts, loading states (`loading.tsx`), and error boundaries (`error.tsx`) with the route, making the codebase self-documenting.
- Server-to-server fetch calls (Next.js server → .NET API) stay on the internal Docker network and never traverse the public internet.
- Incremental Static Regeneration (`next: { revalidate: 60 }`) allows content pages to be cached and rebuilt automatically when content changes, reducing load on the .NET API.

**Negative:**

- The App Router mental model (Server Components vs Client Components, the boundary between them) has a steeper learning curve than the Pages Router for developers new to Next.js 13+.
- Certain React libraries that use browser APIs or React context cannot be used in Server Components. These must be wrapped in Client Components. This occasionally requires extra boilerplate.
- The App Router is younger than the Pages Router and some edge-case bugs existed in early versions. Next.js 14 is now stable, but the ecosystem of third-party examples still often shows Pages Router patterns.
- Debugging hydration mismatches between server-rendered and client-rendered output can be more subtle than in a pure CSR SPA.

---

## ADR-002: ASP.NET Core 8 Web API

**Status:** Accepted  
**Date:** 2026-02-20  
**Deciders:** SLP Systems Engineering Team  

---

### Context

The backend must provide a REST API consumed by the Next.js frontend and host a SignalR WebSocket hub. It must also integrate with ASP.NET Core Identity for authentication and EF Core for database access.

The existing development team has strong .NET experience. The system requires:

1. Mature, stable REST API framework.
2. First-class SignalR support (real-time WebSocket hub for live chat).
3. Battle-tested authentication and authorisation (Cookie, Identity, RBAC).
4. Strong ORM support for the chosen database (SQLite + EF Core).
5. Production-grade structured logging (Serilog integration).
6. Docker-deployable.

The alternatives evaluated:

| Option | SignalR | EF Core | Identity | Ecosystem |
|--------|---------|---------|----------|-----------|
| **ASP.NET Core 8** | Native first-class | Yes | Native | Mature, .NET ecosystem |
| Node.js + Express | Socket.io (third-party) | Sequelize/Prisma | Passport.js | Large, fragmented |
| Node.js + Fastify | Socket.io | Prisma | Third-party | Growing |
| FastAPI (Python) | Via starlette (limited) | SQLAlchemy | Third-party | Strong for data/ML |
| Go (Fiber/Gin) | Via gorilla/websocket | GORM | Third-party | Performant but unfamiliar |
| NestJS (TypeScript) | Native | TypeORM | Passport.js | Structured, familiar to FE devs |

### Decision

Use **ASP.NET Core 8 Web API** with:

- **EF Core 8** with SQLite provider for data access
- **ASP.NET Core Identity** for user management, password hashing, and role management
- **SignalR** (built into ASP.NET Core) for the live chat WebSocket hub
- **Serilog** for structured logging with file and console sinks
- **Swashbuckle (Swagger)** for API documentation (development mode)
- **`Microsoft.Extensions.HealthChecks`** for `/api/health` endpoint

The API uses controller-based routing (`[ApiController]` attribute) rather than minimal APIs, because the feature set requires per-controller authorization attributes, request/response model binding, and structured service injection — all patterns where attribute-based controllers are cleaner than minimal API endpoint definitions.

### Consequences

**Positive:**

- SignalR is a first-party Microsoft library that integrates natively with ASP.NET Core's dependency injection, authentication pipeline, and hosting model. There is no additional library or configuration needed.
- ASP.NET Core Identity handles all password hashing (PBKDF2 with HMAC-SHA512), role management, and claim management out of the box. No custom security code is required for these concerns.
- EF Core Code-First migrations give a controlled, auditable schema change mechanism. The migration history lives in source control alongside the code that changes the schema.
- `[ApiController]` attribute enables automatic model validation — a 400 Bad Request is returned before the action method is even called if the request body fails data annotations. This eliminates boilerplate validation checks.
- .NET 8 is the current LTS (Long-Term Support) release, with support until November 2026. The system is on a supported, stable release.
- Kestrel (the built-in .NET HTTP server) is performant enough for the current load without requiring IIS or Apache.

**Negative:**

- .NET requires a larger Docker image than a Node.js application. The runtime image (`mcr.microsoft.com/dotnet/aspnet:8.0`) is approximately 200MB compressed. A Node.js Alpine image is approximately 50MB. Mitigation: multi-stage Docker build separates the build tools from the runtime image.
- The team must maintain two languages (C# backend + TypeScript frontend) and two build toolchains. For a small team, this can be a context-switching cost.
- .NET startup time in a cold container is a few seconds. The `start_period: 20s` in the Docker health check configuration accounts for this.
- EF Core migrations can fail if the database is in an inconsistent state (e.g., a partially applied migration). This requires care during deployment, especially if the volume is shared across versions.

---

## ADR-003: SQLite as Primary Database

**Status:** Accepted  
**Date:** 2026-02-20  
**Deciders:** SLP Systems Engineering Team  
**Review Trigger:** When concurrent writes exceed SQLite limits or horizontal scaling is needed  

---

### Context

The SLP Systems Portal is a content-driven corporate website with the following database characteristics:

- **Read-heavy workload**: Public visitors read content (blog, services, case studies) far more often than administrators write it.
- **Low write concurrency**: At most a handful of admin users write content simultaneously. Chat messages are written per-message but sessions are serialised per-user.
- **Modest data volume**: Tens to hundreds of content records, thousands of contact messages, tens of thousands of audit log entries.
- **Single-node deployment**: The current architecture runs all containers on one host.
- **No DBA resources**: No dedicated database administrator; the system must be self-managing.

The database options evaluated:

| Option | Complexity | Hosting Cost | Admin Needed | Write Concurrency | Scale-Out |
|--------|-----------|-------------|--------------|-------------------|-----------|
| **SQLite** | Very low | None (file) | None | Single writer | No (single-node) |
| PostgreSQL | Medium | Extra container | Moderate | High (MVCC) | Yes (with pooling) |
| MySQL / MariaDB | Medium | Extra container | Moderate | High | Yes |
| SQL Server (Express) | Medium-high | Extra container | High | High | Yes |
| MongoDB | Medium | Extra container | Moderate | High | Yes |

### Decision

Use **SQLite** as the primary database, configured with:

- **WAL mode** (`PRAGMA journal_mode=WAL`) to allow concurrent reads during writes
- **Busy timeout** (`PRAGMA busy_timeout=5000`) to handle brief write lock contention
- **EF Core SQLite provider** with Code-First migrations
- **Docker volume** (`slp-data`) to persist the database file outside the container
- **Regular backup strategy** (volume snapshot or file copy during low-traffic window)

### Consequences

**Positive:**

- Zero operational overhead. There is no separate database container to monitor, restart, scale, or backup separately. The database is a single file on a Docker volume.
- No connection pool to configure, no authentication to maintain for the database layer. EF Core manages the connection internally.
- SQLite with WAL mode handles the current read-heavy workload efficiently. Public page requests (blog, services) are pure reads and experience no write lock contention.
- The database file is trivially portable. Backup is a simple file copy. Restore is copying the file back. This is operationally simpler than PostgreSQL dump/restore.
- EF Core migrations work identically for SQLite as they do for PostgreSQL. The migration switch is a one-line provider change in `Program.cs` if PostgreSQL is needed in the future.
- Full-text search via SQLite FTS5 extension is available if needed for blog search.

**Negative:**

- **Write concurrency limit**: SQLite allows only one writer at a time. If two requests attempt to write simultaneously, one waits (up to `busy_timeout = 5000ms`). For the current workload (low concurrent writes by admins), this is not a bottleneck, but it is a fundamental architectural limit.
- **No horizontal scaling**: SQLite cannot be shared across multiple backend container instances. If the backend needs to run as multiple replicas (for load balancing or redundancy), SQLite must be replaced with a client-server database (PostgreSQL).
- **No streaming replication**: SQLite has no built-in replication. High-availability setups (primary + read replica) require switching to PostgreSQL or using SQLite-specific tools like Litestream.
- **Size limits**: SQLite supports databases up to 281 TB in theory, but practical performance degrades with very large datasets. This is not a concern for the current use case.
- **No stored procedures or advanced query planner hints**: Complex analytics queries may be slower than on PostgreSQL with its cost-based query planner. Mitigation: keep analytics queries simple; move to PostgreSQL if needed.

**Migration Path to PostgreSQL:**

If the above limitations become constraints, the migration path is:

1. Add `Npgsql.EntityFrameworkCore.PostgreSQL` package.
2. Change `options.UseSqlite(...)` to `options.UseNpgsql(...)` in `Program.cs`.
3. Generate a new initial migration baseline from the current schema.
4. Export SQLite data to PostgreSQL via a one-time migration script.
5. Deploy with the new provider.

All repository, service, and controller code remains unchanged because they use EF Core LINQ, not SQLite-specific SQL.

---

## ADR-004: SignalR for Real-Time Chat

**Status:** Accepted  
**Date:** 2026-02-25  
**Deciders:** SLP Systems Engineering Team  

---

### Context

The SLP Systems Portal requires a live chat feature that allows website visitors to initiate a chat session with SLP Systems support staff, and for support staff to respond in real time from the admin dashboard.

The requirements are:

- Messages must appear immediately on both sides without the user pressing a refresh button.
- The connection must be maintained for the duration of the chat session (potentially 30+ minutes).
- Multiple admins should be able to see all incoming sessions simultaneously.
- The solution must work through an Nginx reverse proxy.
- The backend is ASP.NET Core 8.
- The frontend is Next.js 14 with TypeScript.

The real-time communication options evaluated:

| Option | Protocol | Push to client | .NET native | Nginx support | Fallback |
|--------|----------|---------------|-------------|---------------|----------|
| **SignalR** | WebSocket (+ fallback) | Yes | Yes (first-party) | Yes (upgrade) | Long polling, SSE |
| Socket.io | WebSocket (+ fallback) | Yes | Via library | Yes | Long polling |
| Server-Sent Events (SSE) | HTTP/1.1 | Server→Client only | Via streaming response | Yes | — |
| Short polling | HTTP | No (pull) | Yes | Yes | — |
| Long polling | HTTP | Simulated push | Yes | Yes | — |
| gRPC streaming | HTTP/2 | Yes (bidirectional) | Yes | Partial (HTTP/2) | None |
| WebSocket (raw) | WebSocket | Yes | Via middleware | Yes (upgrade) | None |

### Decision

Use **ASP.NET Core SignalR** with the `@microsoft/signalr` client library on the frontend.

SignalR is the standard real-time communications abstraction in the ASP.NET Core ecosystem. It provides:

- A Hub abstraction (`ChatHub`) where server methods can be called from the client and client methods can be called from the server.
- Automatic transport negotiation: WebSocket is preferred; SignalR falls back to Server-Sent Events, then long polling if WebSocket is not available.
- Group-based broadcasting: visitors join a group `session-{sessionId}`, admins join group `admins`. Broadcasting to a group requires no knowledge of individual connection IDs.
- First-class ASP.NET Core DI integration: `ChatHub` has `IUnitOfWork` and `ILogger` injected via the constructor, the same as any controller.

Nginx is configured with the WebSocket upgrade headers for the `/hubs/` path:

```nginx
location /hubs/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

The 86400s read timeout (24 hours) prevents Nginx from closing idle WebSocket connections during a long chat session.

### Consequences

**Positive:**

- SignalR is bundled with ASP.NET Core — no additional server-side packages are required. The `@microsoft/signalr` npm package is the official Microsoft client.
- The transport fallback mechanism means the live chat works even in environments that block WebSocket (corporate firewalls, older proxies). SignalR automatically negotiates the best available transport.
- Hub methods (`SendMessage`, `AdminReply`, `MarkRead`) are strongly typed and invocable by name from the TypeScript client. This is more maintainable than constructing raw WebSocket message frames.
- The group-based pub/sub model (`session-{id}` group + `admins` group) cleanly handles multi-admin scenarios: all connected admins see all incoming messages without needing to poll or maintain a shared state variable.
- Persistence is handled naturally: every message sent through the hub is saved to the `ChatMessages` SQLite table before being broadcast. If an admin disconnects and reconnects, they can load the message history from the database.

**Negative:**

- SignalR requires sticky sessions (session affinity) when running multiple backend instances, because a WebSocket connection is tied to a specific server process. The SignalR Redis backplane would be required for multi-instance deployments. This is not a current concern (single-node) but must be addressed before horizontal scaling.
- The `@microsoft/signalr` npm package adds approximately 130 KB to the frontend bundle. This is only loaded on pages that use the live chat widget (public chat button and admin live-chat page).
- Debugging WebSocket connections is more complex than debugging standard HTTP requests. Browser DevTools WebSocket inspection is required to trace SignalR hub messages.
- SignalR connections are stateful. A backend restart terminates all active WebSocket connections. Clients must reconnect and re-join their groups. The SignalR client library handles automatic reconnection, but there is a brief gap in the chat during a deployment.

---

## ADR-005: Cookie Authentication

**Status:** Accepted  
**Date:** 2026-02-20  
**Deciders:** SLP Systems Engineering Team  

---

### Context

The admin dashboard and customer portal require authentication. Users must log in once and remain authenticated for their working session (up to 8 hours). The system must protect admin API endpoints from unauthenticated and unprivileged access.

The two primary authentication mechanisms for a web application are:

**Option A: JWT Bearer Tokens (stateless)**
- Client receives a signed JWT on login.
- Client stores JWT in `localStorage` or `sessionStorage`.
- Client sends JWT in `Authorization: Bearer <token>` header on every request.
- Server validates the JWT signature — no server-side state required.
- Common for SPAs and mobile apps.

**Option B: Cookie Authentication (session-like)**
- Client receives an encrypted, signed cookie on login.
- Browser stores and transmits the cookie automatically (no client code required).
- Server decrypts and validates the cookie — the `ClaimsPrincipal` is populated.
- Common for server-rendered web applications.

### Decision

Use **ASP.NET Core Cookie Authentication** via `AddIdentity` + `ConfigureApplicationCookie`.

The cookie is configured as:

```csharp
options.Cookie.HttpOnly = true;         // Inaccessible to JavaScript
options.Cookie.SameSite = SameSiteMode.None;  // Required for cross-origin (Nginx proxy)
options.Cookie.SecurePolicy = CookieSecurePolicy.Always;  // HTTPS only
options.ExpireTimeSpan = TimeSpan.FromHours(8);  // 8-hour session
options.SlidingExpiration = true;       // Reset expiry on activity
```

### Consequences

**Positive:**

- **XSS protection**: The `HttpOnly` flag makes the authentication cookie inaccessible to JavaScript. An XSS attack cannot steal the cookie with `document.cookie` the way it can steal a JWT from `localStorage`. This is the primary security reason to prefer cookies over localStorage-stored JWTs for web applications.
- **Automatic transmission**: The browser sends the cookie automatically on every request to the origin domain without any client-side code. No `Authorization` header construction is needed in the frontend fetch calls (only `credentials: "include"` is required).
- **Sliding expiration**: The 8-hour session resets to 8 hours on every request. An actively working admin is never abruptly logged out. A session that has been inactive for 8 hours expires naturally.
- **Integration with ASP.NET Identity**: The cookie is issued, validated, and revoked by the same Identity stack that manages users and roles. There is no separate token service to operate.
- **CSRF considerations**: `SameSite=None` is required because the frontend (port 3000) and backend (port 5062) are different origins in development. In production behind Nginx, they share the same origin. The `Secure` flag ensures the cookie is only transmitted over HTTPS, limiting the CSRF exposure.

**Negative:**

- **Cross-origin complication**: Because the Next.js frontend and .NET backend run on different origins during development, `SameSite=None` + `Secure` is required. `credentials: "include"` must be set on every `fetch()` call to admin endpoints. This is a common source of confusion for new developers on the project.
- **Not suitable for mobile API clients**: Cookie-based auth is designed for web browsers. If a future mobile app or third-party client needs to consume the API, a separate JWT endpoint would need to be added.
- **Server memory usage**: Each cookie is validated by decrypting it on the server for every request. While this is lightweight, it is slightly more server-side work than stateless JWT validation.
- **Cookie size limit**: Browser cookies are limited to approximately 4KB. The ASP.NET Core Identity cookie includes user claims, and if a user has many roles or custom claims, the cookie could approach this limit. For the current two-role system (`Admin`, `Customer`), this is not a concern.

---

## ADR-006: Repository + Unit of Work Pattern

**Status:** Accepted  
**Date:** 2026-02-22  
**Deciders:** SLP Systems Engineering Team  

---

### Context

The application needs a structured approach to database access. The naive approach in an EF Core application is to inject `ApplicationDbContext` directly into service classes or controllers and write LINQ queries inline. This approach has the following problems at scale:

1. **No separation of concerns**: Business logic and data access are mixed in the same class.
2. **Not testable in isolation**: To test a service, you need a real (or in-memory) `DbContext`.
3. **Duplicated queries**: The same `WHERE IsPublished = 1 ORDER BY PublishedAt DESC` query appears in multiple places.
4. **No atomic multi-entity commits**: If a service saves a blog post and an audit log entry in separate `SaveChangesAsync()` calls, they cannot be rolled back together if the second call fails.
5. **Harder to switch databases**: Raw EF Core LINQ queries tied to specific provider features are harder to swap.

The options considered:

| Option | Testability | Atomic commits | Abstraction |
|--------|-------------|----------------|-------------|
| **Direct DbContext injection** | Poor (needs real DB) | Manual (wrap in BeginTransaction) | None |
| **Repository only (no UoW)** | Good (mock per repo) | Poor (multiple SaveChanges) | Good per-entity |
| **Repository + Unit of Work** | Good (mock UoW) | Excellent (one SaveChanges) | Good |
| **CQRS (Command Query Separation)** | Excellent | Excellent | High (over-engineered for this scale) |

### Decision

Use the **Repository Pattern** combined with the **Unit of Work Pattern** as follows:

1. **`IRepository<T>` base interface**: Defines `AddAsync`, `UpdateAsync`, `DeleteAsync`, `GetByIdAsync`, `GetAllAsync`.
2. **Domain-specific repository interfaces** extend `IRepository<T>` with query methods: `IBlogRepository.GetPublishedAsync()`, `IBlogRepository.GetBySlugAsync()`.
3. **Concrete implementations** in `Repositories/Implementations/` contain all EF Core LINQ queries.
4. **`IUnitOfWork`** exposes all repositories as properties and a single `SaveChangesAsync()`.
5. **All repositories share one `ApplicationDbContext`** instance (injected into `UnitOfWork` constructor by the DI container).

```
Services inject: IUnitOfWork
Controllers inject: IUnitOfWork (for simple CRUD), IService (for business logic)

Never:
  Controllers or Services inject ApplicationDbContext directly
  Controllers or Services write LINQ queries
```

### Consequences

**Positive:**

- **Testability**: Services can be unit-tested by injecting a mock `IUnitOfWork` that returns test data without needing a database at all. This makes tests fast and deterministic.
- **Atomic multi-entity writes**: A service can modify a blog post, add an audit log entry, and update site statistics, then call `_uow.SaveChangesAsync()` once. All three writes succeed or all three fail — no partial commits.
- **Single source of truth for queries**: The query `WHERE IsPublished = 1 ORDER BY PublishedAt DESC LIMIT 10` lives in exactly one place: `BlogRepository.GetPublishedAsync()`. If the query changes, it changes in one file.
- **Lazy initialisation**: `UnitOfWork` uses the null-coalescing assignment (`??=`) to create repository instances only when first accessed. A request that only reads blog posts never instantiates the `TeamMemberRepository`.
- **Clean DI graph**: Controllers declare their dependencies in the constructor. The DI container resolves `IUnitOfWork` → `UnitOfWork` → `ApplicationDbContext` automatically with `Scoped` lifetime.

**Negative:**

- **Boilerplate per entity**: Every new entity requires an interface, an implementation, and a property in `IUnitOfWork` / `UnitOfWork`. For a system with 15 entities, this is approximately 45 files for the data access layer alone. This is more files than injecting `DbContext` directly but the tradeoff in testability and maintainability is worthwhile.
- **Leaky abstraction risk**: If a repository method returns `IQueryable<T>` rather than a materialised list, callers can build on top of the query outside the repository, which defeats the abstraction. All repository methods in this codebase return materialised `List<T>` or `T?` to prevent this.
- **Slight impedance mismatch with EF Core's own UoW**: EF Core's `DbContext` is itself a Unit of Work. Wrapping it in another UoW layer is technically redundant. However, the abstraction is valuable for testability and the cognitive clarity it provides for developers who are not EF Core experts.

---

## ADR-007: Nginx as Reverse Proxy

**Status:** Accepted  
**Date:** 2026-02-20  
**Deciders:** SLP Systems Engineering Team  

---

### Context

The system has two application containers (Next.js frontend on port 3000, ASP.NET Core backend on port 5062) that must be accessible to the internet via a single entry point on ports 80 and 443. Additionally:

1. Both HTTP and WebSocket (SignalR) traffic must be routed correctly.
2. TLS termination must happen at a single point.
3. Rate limiting at the network edge (before the application layer) is desirable.
4. Static file serving should be efficient.
5. Security headers should be applied uniformly.

The alternatives considered:

| Option | TLS | WebSocket | Rate Limiting | Static files | Docker |
|--------|-----|-----------|---------------|-------------|--------|
| **Nginx** | Yes | Yes (upgrade) | Yes (ngx_http_limit_req) | Excellent | nginx:alpine (small) |
| Caddy | Yes (auto HTTPS) | Yes | Limited | Good | Moderate size |
| Traefik | Yes (auto) | Yes | Via plugins | Basic | Moderate size |
| HAProxy | Yes | Yes | Yes | No | Small |
| Expose ports directly | N/A | N/A | None | N/A | None needed |

**"Expose ports directly"** was considered: map port 3000 and 5062 directly to the host and let clients call them separately. This was rejected because:

- Two ports means two TLS certificates or no TLS.
- The frontend's server-side `fetch()` calls would need to use the public backend URL, exposing the backend directly.
- Rate limiting would require application-layer-only protection.
- CORS complexity increases because frontend and API are on different origins in production.

### Decision

Use **Nginx 1.25-alpine** as the unified reverse proxy with the following routing rules:

```
/api/*    → proxy to http://backend:5062  (rate limit: api zone, 20 req/s burst 40)
/hubs/*   → proxy to http://backend:5062  (WebSocket upgrade, 24h timeout)
/swagger/ → proxy to http://backend:5062  (dev only)
/*        → proxy to http://frontend:3000 (rate limit: general zone, 50 req/s burst 100)
```

The Nginx configuration includes:

- **Rate limiting** with two zones: `api` for `/api/` routes, `general` for all other traffic.
- **Security headers** applied at the Nginx level: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`.
- **Gzip compression** for `text/plain`, `text/css`, `application/json`, `application/javascript`.
- **WebSocket upgrade** headers for the `/hubs/` path with a 86400s read timeout.
- **`client_max_body_size 20M`** to cap request body size.

### Consequences

**Positive:**

- **Single entry point**: All traffic enters on port 80 (HTTP) or 443 (HTTPS). No application ports are publicly exposed. The Docker Compose configuration maps only `:80` and `:443` to the host.
- **TLS termination at Nginx**: The SSL certificate is managed in one place. Application containers communicate over unencrypted HTTP on the internal Docker network, which is acceptable because the Docker network is not externally reachable.
- **Nginx-level rate limiting** is enforced before the request reaches any application code. A DoS attempt that saturates the Nginx rate limit is dropped without consuming .NET thread pool threads or EF Core connections.
- **WebSocket upgrade negotiation** is handled by Nginx. The backend does not need to be exposed directly for SignalR connections; Nginx manages the HTTP-to-WebSocket upgrade transparently.
- **Small image**: `nginx:1.25-alpine` is approximately 22MB. It starts in milliseconds and uses negligible CPU and memory when idle.
- **Gzip compression**: Text-based responses (JSON, HTML, CSS, JavaScript) are compressed before delivery, reducing bandwidth consumption for visitors.

**Negative:**

- **Additional configuration file**: The `nginx/nginx.conf` must be maintained as the system evolves. Adding a new backend endpoint path or a new upstream service requires an Nginx config change.
- **SSL certificate management**: The current configuration includes TLS placeholders but requires manual certificate provisioning (Let's Encrypt / Certbot or purchased certificate). Auto-renewal must be configured separately (e.g., Certbot cron job mounting the certificate directory).
- **WebSocket sticky session requirement (future)**: If the backend runs as multiple replicas, the Nginx upstream must use `ip_hash` or a cookie-based sticky session directive to ensure WebSocket connections (which are stateful) always reach the same backend instance.
- **Single point of failure**: If Nginx crashes, all traffic is lost. Mitigation: `restart: unless-stopped` policy, and Nginx is extremely stable under normal operating conditions.

---

## ADR-008: Tiptap Rich Text Editor

**Status:** Accepted  
**Date:** 2026-02-24  
**Deciders:** SLP Systems Engineering Team  

---

### Context

The admin dashboard requires a rich text editor for creating and editing:

- Blog posts (full article with headings, lists, bold/italic, code blocks)
- Service descriptions
- Case study content
- Industry solution descriptions

The editor must:

1. Integrate seamlessly with React and Next.js.
2. Produce clean HTML output that can be stored in the database as a string and rendered safely in the frontend.
3. Support headings, bold, italic, underline, unordered lists, ordered lists, links, and code blocks as a minimum.
4. Be maintainable and have good TypeScript support.
5. Not require a server-side licence or CDN-loaded script.

The rich text editors evaluated:

| Editor | React Integration | TypeScript | License | Bundle Size | Output Format |
|--------|-------------------|------------|---------|-------------|---------------|
| **Tiptap v3** | `@tiptap/react` native | Excellent | MIT | ~50KB | HTML |
| TinyMCE 7 | React wrapper | Good | GPL/Paid | ~400KB | HTML |
| Quill 2 | React wrapper | Moderate | BSD | ~100KB | Delta/HTML |
| CKEditor 5 | React component | Good | GPL/Paid | ~300KB | HTML/Markdown |
| Slate.js | React native | Good | MIT | ~150KB | Custom JSON |
| ProseMirror (raw) | Manual integration | Good | MIT | ~50KB | ProseMirror JSON |
| Draft.js | React native | Moderate | MIT (Facebook) | ~200KB | ContentState |

**Key evaluation criteria:**

- **TinyMCE** and **CKEditor 5** offer excellent features but require a paid licence for commercial use or impose the GPL copyleft licence. For a commercial product, this introduces licence obligations.
- **Quill** has not had a stable major release in years (v2 beta has stalled) and its React integration is community-maintained with varying quality.
- **Slate.js** produces a custom JSON AST rather than HTML. Converting this to safe, renderable HTML for the public frontend requires additional processing.
- **ProseMirror** is the underlying engine that Tiptap is built on. Using ProseMirror directly gives maximum control but requires significant custom code to build a toolbar and toolbar extensions.
- **Tiptap** is built on ProseMirror and provides a clean React-first API, a thriving extension ecosystem, excellent TypeScript types, and an MIT licence. The starter kit (`@tiptap/starter-kit`) bundles the most common extensions.

### Decision

Use **Tiptap v3** with the following packages:

```
@tiptap/react             — React integration and useEditor hook
@tiptap/starter-kit       — Bold, Italic, Heading, Lists, Code, Blockquote, HorizontalRule
@tiptap/extension-placeholder — Placeholder text for empty editor
```

The editor is implemented as a client component (`"use client"`) with `useEditor()` hook:

```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: "Start writing..." }),
  ],
  content: initialHtml,
  onUpdate: ({ editor }) => {
    onChange(editor.getHTML());
  },
});
```

The output of `editor.getHTML()` is a clean HTML string that is stored in the database and rendered in the public frontend via React's `dangerouslySetInnerHTML`. HTML sanitisation should be applied before rendering (via a library such as DOMPurify) to prevent XSS if content originates from untrusted sources. In this system, only authenticated admin users create content, so the current risk is low, but sanitisation is recommended as a defence-in-depth measure.

### Consequences

**Positive:**

- **MIT licence**: Tiptap core and all extensions used are MIT-licensed. No licence cost, no copyleft obligations.
- **React-first API**: The `useEditor()` hook integrates naturally with React state. The editor instance is a controlled component — content changes are propagated via the `onUpdate` callback.
- **TypeScript support**: All Tiptap packages ship TypeScript definitions. Extensions can be typed, and custom extensions can extend the `Node` or `Mark` types.
- **ProseMirror foundation**: Tiptap inherits all ProseMirror's stability and correctness. ProseMirror is used in production by companies like Atlassian (Confluence), LinkedIn, and many others.
- **HTML output**: The editor produces standard HTML strings. No custom serialiser or deserialiser is needed. The frontend renders the stored HTML directly.
- **Extension ecosystem**: If richer formatting (tables, image upload, mentions, colour picker) is needed in the future, Tiptap provides official or community extensions that can be added to the `extensions` array without rewriting the editor component.
- **Bundle size**: The starter kit and placeholder extension together add approximately 50KB to the admin bundle. This is acceptable because the Tiptap components are only loaded on admin content-editing pages, not on public-facing pages.

**Negative:**

- **No toolbar included**: Tiptap does not include a pre-built toolbar UI. A custom toolbar must be built using buttons that call editor commands (`editor.chain().focus().toggleBold().run()`). This is a small but non-trivial amount of UI code. For this project, a minimal toolbar was implemented covering the required formatting options.
- **SSR incompatibility**: `useEditor()` is a client-side hook and cannot run in Next.js Server Components. The editor component must be wrapped in `"use client"` and conditionally rendered after hydration to avoid server/client mismatch. The common pattern is to use `dynamic(() => import('./TiptapEditor'), { ssr: false })`.
- **v3 is a recent major version**: Tiptap v3 was released in early 2026. While it is stable, the ecosystem of third-party extensions may not yet be fully updated to v3's API. The officially maintained extensions are up to date, but custom or community extensions may require adaptation.
- **XSS risk on render**: HTML output from any rich text editor should be sanitised before rendering in a browser context. If content were editable by untrusted users (not the case currently, as only admins create content), unescaped HTML could contain `<script>` tags. Using `dangerouslySetInnerHTML` without sanitisation is a risk that should be addressed with DOMPurify or similar when user-generated content is introduced.

---

*This ADR log is append-only. Accepted decisions are not edited — if a decision changes, a new ADR superseding the original is added. The original ADR is updated to status "Superseded by ADR-NNN".*
