# Sequence Diagrams — SLP Systems Portal

**Version:** 1.0  
**Date:** 2026-03-03  
**Format:** Mermaid sequenceDiagram syntax (renders on GitHub)

---

## Table of Contents

1. [Admin Login Sequence](#1-admin-login-sequence)
2. [Public Page Load with SSR](#2-public-page-load-with-ssr)
3. [Live Chat Message Send](#3-live-chat-message-send)
4. [Job Application Submit](#4-job-application-submit)
5. [Admin Creating a Blog Post with Rich Text](#5-admin-creating-a-blog-post-with-rich-text)
6. [Docker Health Check Sequence](#6-docker-health-check-sequence)

---

## 1. Admin Login Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant Browser
    participant NextJS as Next.js (App Router)
    participant API as .NET API (AuthController)
    participant Identity as ASP.NET Identity
    participant DB as SQLite (AspNetUsers)
    participant Cookie as Browser Cookie Jar

    Admin->>Browser: Navigate to /auth/login
    Browser->>NextJS: GET /auth/login
    NextJS-->>Browser: Render login page (Server Component)

    Admin->>Browser: Enter email + password, click Login
    Browser->>NextJS: Client-side form submit

    Note over Browser,NextJS: Client validates: email not empty, password not empty

    Browser->>API: POST /api/auth/login<br/>Body: {email, password}<br/>credentials: include
    
    Note over API: CorrelationIdMiddleware assigns correlationId<br/>SecurityHeadersMiddleware adds security headers<br/>RateLimitingMiddleware checks per-IP count

    API->>Identity: _userManager.FindByEmailAsync(email)
    Identity->>DB: SELECT * FROM AspNetUsers WHERE Email = ?
    DB-->>Identity: User row or null
    Identity-->>API: IdentityUser or null

    alt User not found
        API-->>Browser: 401 Unauthorized<br/>{detail: "Invalid email or password.",<br/>error_code: "INVALID_CREDENTIALS",<br/>correlation_id: "..."}
        Browser-->>Admin: Show error toast
    else User found
        API->>Identity: _signInManager.PasswordSignInAsync(user, password, isPersistent=false, lockoutOnFailure=true)
        Identity->>DB: Verify PasswordHash (BCrypt)
        Identity->>DB: Check LockoutEnabled + AccessFailedCount
        DB-->>Identity: Verification result

        alt Wrong password
            Identity->>DB: UPDATE AspNetUsers SET AccessFailedCount++
            DB-->>Identity: Updated
            Identity-->>API: SignInResult.Failed
            API-->>Browser: 401 {error_code: "INVALID_CREDENTIALS"}
            Browser-->>Admin: Show error toast
        else Account locked
            Identity-->>API: SignInResult.IsLockedOut = true
            API-->>Browser: 401 {error_code: "ACCOUNT_LOCKED"}
            Browser-->>Admin: Show lockout message
        else Sign-in success
            Identity->>DB: UPDATE AspNetUsers SET AccessFailedCount=0
            Identity->>DB: INSERT AspNetUserTokens (session token)
            DB-->>Identity: Saved
            Identity-->>API: SignInResult.Succeeded

            API->>Identity: _userManager.GetRolesAsync(user)
            Identity->>DB: SELECT r.Name FROM AspNetRoles r JOIN AspNetUserRoles ur...
            DB-->>Identity: roles[] e.g. ["Admin"]
            Identity-->>API: roles[]

            Note over API: SignInManager sets auth cookie internally via IAuthenticationService
            API->>Cookie: Set-Cookie: .AspNetCore.Identity.Application=<encrypted_ticket>;<br/>HttpOnly; Secure; SameSite=None; Max-Age=28800

            API-->>Browser: 200 OK<br/>{detail: "Login successful.",<br/>user: {id, email, userName, roles[]}}

            Browser->>Cookie: Store auth cookie
            Browser->>NextJS: Redirect to /admin/dashboard
            NextJS-->>Browser: Render admin dashboard (with cookie attached)
            Browser-->>Admin: Admin dashboard displayed
        end
    end
```

---

## 2. Public Page Load with SSR

```mermaid
sequenceDiagram
    autonumber
    actor Visitor
    participant Browser
    participant NextJS as Next.js (Server Component)
    participant Cache as Next.js Cache
    participant API as .NET API (HomeController)
    participant Services as Service Layer
    participant Repos as Repository Layer
    participant DB as SQLite

    Visitor->>Browser: Navigate to https://slpsystems.ca/
    Browser->>NextJS: GET /

    Note over NextJS: Next.js 13 App Router processes route<br/>page.tsx is a Server Component - runs on Node.js server

    NextJS->>Cache: Check fetch cache for /api/home
    
    alt Cache HIT (within revalidation window)
        Cache-->>NextJS: Cached HomePageData
        NextJS-->>Browser: HTML with cached data (no API call)
        Browser-->>Visitor: Page renders instantly
    else Cache MISS or expired
        NextJS->>API: GET http://backend:5062/api/home<br/>(internal network call, no browser involved)

        Note over API: CorrelationIdMiddleware: assign correlationId<br/>SecurityHeadersMiddleware: set X-Content-Type-Options etc.<br/>RateLimitingMiddleware: check IP rate limit<br/>ApiRequestTrackingMiddleware: log request start

        API->>Services: ISiteService.GetSettingsAsync()
        Services->>Repos: IUnitOfWork.SiteSettings.GetAllAsync()
        Repos->>DB: SELECT * FROM SiteSettings WHERE Id = 1
        DB-->>Repos: SiteSettings row
        Repos-->>Services: SiteSettings
        Services-->>API: SiteSettings

        API->>Services: Parallel fetches:<br/>Services, Testimonials, CaseStudies,<br/>Industries, Videos, RecentPosts, Team
        
        par Fetch all homepage data in parallel
            Services->>Repos: Services.GetAllAsync() where IsActive
            Services->>Repos: Testimonials.GetAllAsync() where IsActive
            Services->>Repos: CaseStudies.GetAllAsync() where IsActive
            Services->>Repos: IndustrySolutions.GetAllAsync() where IsActive
            Services->>Repos: VideoDemos.GetAllAsync() where IsActive
            Services->>Repos: Blog.GetRecentAsync(count=3)
            Services->>Repos: TeamMembers.GetAllAsync() where IsActive
        end

        par DB queries execute
            Repos->>DB: SELECT * FROM Services WHERE IsActive=1 ORDER BY SortOrder
            Repos->>DB: SELECT * FROM Testimonials WHERE IsActive=1 ORDER BY SortOrder
            Repos->>DB: SELECT * FROM CaseStudies WHERE IsActive=1 ORDER BY SortOrder
            Repos->>DB: SELECT * FROM IndustrySolutions WHERE IsActive=1 ORDER BY SortOrder
            Repos->>DB: SELECT * FROM VideoDemos WHERE IsActive=1 ORDER BY SortOrder
            Repos->>DB: SELECT TOP 3 * FROM BlogPosts WHERE IsPublished=1 ORDER BY PublishedAt DESC
            Repos->>DB: SELECT * FROM TeamMembers WHERE IsActive=1 ORDER BY SortOrder
        end

        DB-->>Repos: All result sets returned
        Repos-->>Services: Aggregated data
        Services-->>API: HomePageData assembled

        Note over API: ApiRequestTrackingMiddleware: log StatusCode, DurationMs to DB<br/>Serilog request logging: structured log entry
        API-->>NextJS: 200 OK { featuredServices[], testimonials[], caseStudies[], ... }

        NextJS->>Cache: Store response in fetch cache (revalidate: 300s)
        
        Note over NextJS: Server Component renders complete HTML:<br/>- HeroCarousel with slide data<br/>- ServiceCarousel with service cards<br/>- All sections pre-populated
        NextJS-->>Browser: Full HTML + hydration scripts

        Browser->>Browser: Parse HTML, download JS chunks
        Browser->>Browser: React hydrates interactive components<br/>(HeroCarousel, ServiceCarousel, ChatWidget)
        Browser-->>Visitor: Page fully interactive
    end

    Note over Browser,Visitor: ChatWidget floating button appears<br/>No SignalR connection yet - lazy loaded on click
```

---

## 3. Live Chat Message Send

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    actor Admin
    participant CWidget as ChatWidget (Browser)
    participant APanel as Admin Live Chat Panel (Browser)
    participant SignalR as SignalR Hub (/hubs/chat)
    participant UoW as Unit of Work
    participant DB as SQLite (ChatMessages)
    participant GAdmin as "admins" SignalR Group
    participant GSession as "session-{id}" SignalR Group

    Note over Customer,CWidget: Customer has opened ChatWidget,<br/>entered name + email, sessionId generated

    Customer->>CWidget: Open chat widget
    CWidget->>SignalR: WebSocket connect to /hubs/chat
    SignalR-->>CWidget: Connection established, connectionId assigned

    CWidget->>SignalR: invoke("JoinSession", sessionId, "Alice", "alice@example.com")
    SignalR->>GSession: AddToGroupAsync(connectionId, "session-{sessionId}")
    SignalR->>GAdmin: SendAsync("CustomerConnected", {sessionId, name, email, connectedAt})
    GAdmin-->>APanel: CustomerConnected event received
    APanel->>APanel: Add Alice's session to active session list
    APanel->>APanel: Show unread badge notification

    Note over Admin,APanel: Admin is already in /admin/live-chat<br/>with JoinAdminRoom previously called

    Customer->>CWidget: Type "Hello, I need help with my account"
    Customer->>CWidget: Press Send

    CWidget->>SignalR: invoke("SendMessage", sessionId, "Alice", "alice@example.com",<br/>"Hello, I need help with my account", null)

    Note over SignalR: Hub receives SendMessage call

    SignalR->>SignalR: Create ChatMessage entity<br/>{SessionId, SenderName="Alice",<br/>SenderEmail="alice@example.com",<br/>Content="Hello...",<br/>IsFromAdmin=false, IsRead=false}

    SignalR->>UoW: ChatMessages.AddAsync(msg)
    UoW->>DB: INSERT INTO ChatMessages (...) VALUES (...)
    DB-->>UoW: Row inserted, Id assigned
    UoW-->>SignalR: Entity has Id

    SignalR->>UoW: SaveChangesAsync()
    UoW->>DB: COMMIT transaction
    DB-->>UoW: 1 row affected
    UoW-->>SignalR: Saved

    Note over SignalR: Build payload: {id, sessionId, senderName,<br/>senderEmail, content, isFromAdmin=false, createdAt}

    par Relay to both groups simultaneously
        SignalR->>GAdmin: SendAsync("ReceiveMessage", payload)
        SignalR->>GSession: SendAsync("ReceiveMessage", payload)
    end

    GAdmin-->>APanel: ReceiveMessage event
    APanel->>APanel: Append message to Alice's session thread
    APanel->>APanel: Update unread count badge

    GSession-->>CWidget: ReceiveMessage event
    CWidget->>CWidget: Append message to own thread (echo confirmation)
    CWidget-->>Customer: Message appears as "sent"

    Note over Admin,APanel: Admin clicks on Alice's session to respond

    Admin->>APanel: Click on Alice's session
    APanel->>SignalR: invoke("MarkRead", sessionId)
    SignalR->>UoW: ChatMessages.MarkSessionReadAsync(sessionId)
    UoW->>DB: UPDATE ChatMessages SET IsRead=1<br/>WHERE SessionId=? AND IsFromAdmin=0
    DB-->>UoW: N rows updated
    UoW-->>SignalR: Done
    SignalR->>UoW: SaveChangesAsync()
    UoW->>DB: COMMIT
    DB-->>UoW: Committed
    APanel->>APanel: Unread badge cleared for this session

    Admin->>APanel: Type "Hi Alice, I can help you with that."
    Admin->>APanel: Press Send Reply

    APanel->>SignalR: invoke("AdminReply", sessionId, "Support Agent", "Hi Alice...")

    SignalR->>SignalR: Create ChatMessage entity<br/>{IsFromAdmin=true, IsRead=true,<br/>SenderName="Support Agent"}

    SignalR->>UoW: ChatMessages.AddAsync(replyMsg)
    UoW->>DB: INSERT INTO ChatMessages (...) VALUES (...)
    DB-->>UoW: Saved with new Id
    SignalR->>UoW: SaveChangesAsync()
    UoW->>DB: COMMIT
    DB-->>UoW: Committed

    Note over SignalR: Build reply payload: {isFromAdmin=true, ...}

    par Relay admin reply
        SignalR->>GSession: SendAsync("ReceiveMessage", replyPayload)
        SignalR->>GAdmin: SendAsync("ReceiveMessage", replyPayload)
    end

    GSession-->>CWidget: ReceiveMessage event (admin reply)
    CWidget->>CWidget: Append admin message with distinct styling
    CWidget-->>Customer: "Hi Alice, I can help..." appears in real-time

    GAdmin-->>APanel: ReceiveMessage echo (for multi-tab admin support)
    APanel->>APanel: Reply confirmed in thread
    APanel-->>Admin: Conversation continues
```

---

## 4. Job Application Submit

```mermaid
sequenceDiagram
    autonumber
    actor Visitor
    participant Browser
    participant NextJS as Next.js (Page)
    participant API as .NET API (JobsController)
    participant DB as SQLite
    participant Email as EmailService (SMTP)

    Visitor->>Browser: Navigate to /careers
    Browser->>NextJS: GET /careers

    Note over NextJS: Server Component fetches jobs
    NextJS->>API: GET /api/jobs (no auth needed)
    API->>DB: SELECT Id,Title,Slug,Department,Location,EmploymentType,SalaryRange,Summary<br/>FROM JobPostings WHERE IsActive=1 ORDER BY SortOrder
    DB-->>API: Active job postings
    API-->>NextJS: JobPosting[] (public fields only)
    NextJS-->>Browser: Rendered careers page with job list

    Visitor->>Browser: Click on "Data Engineer" position
    Browser->>NextJS: GET /careers/data-engineer
    NextJS->>API: GET /api/jobs/slug/data-engineer
    API->>DB: SELECT * FROM JobPostings WHERE Slug='data-engineer' AND IsActive=1
    DB-->>API: JobPosting row with full Description, Requirements, NiceToHave
    API-->>NextJS: Full JobPosting
    NextJS-->>Browser: Job detail page rendered

    Visitor->>Browser: Click "Apply Now"
    Browser->>Browser: Application form slides into view (Client Component)

    Visitor->>Browser: Fill form fields:<br/>Name="Jane Smith", Email="jane@example.com",<br/>Phone="403-555-0100",<br/>LinkedIn="linkedin.com/in/janesmith",<br/>CoverLetter="I am excited to..."

    Visitor->>Browser: Click "Submit Application"
    
    Note over Browser: Client-side validation:<br/>Name required, Email format valid
    
    Browser->>API: POST /api/jobs/{jobId}/apply<br/>Body: {name, email, phone, linkedInUrl, portfolioUrl, coverLetter}<br/>credentials: include

    Note over API: CorrelationIdMiddleware: assign correlationId<br/>RateLimitingMiddleware: check IP (prevents spam)

    API->>DB: SELECT * FROM JobPostings WHERE Id = {jobId}
    DB-->>API: JobPosting row

    alt Job not found or inactive
        API-->>Browser: 404 {detail: "Job not found.", error_code: "NOT_FOUND"}
        Browser-->>Visitor: Show "Position no longer available"
    else Job found and active
        Note over API: ModelState validation runs<br/>- Email format via [EmailAddress]<br/>- Required fields present
        
        alt ModelState invalid
            API-->>Browser: 400 {detail: "...", error_code: "VALIDATION_ERROR", errors: {...}}
            Browser-->>Visitor: Show inline field errors
        else ModelState valid
            API->>DB: INSERT INTO JobApplications<br/>(JobPostingId, Name, Email, Phone, LinkedInUrl,<br/>PortfolioUrl, CoverLetter, Status='New',<br/>CreatedAt=UTC, UpdatedAt=UTC)
            DB-->>API: New row with Id

            API->>DB: UPDATE JobPostings<br/>SET ApplicationCount = ApplicationCount + 1<br/>WHERE Id = {jobId}
            DB-->>API: 1 row updated

            API->>DB: SaveChanges() - COMMIT
            DB-->>API: Transaction committed

            Note over API: Log: "New application for job {jobId} from {email}"

            API-->>Browser: 200 OK<br/>{detail: "Application submitted successfully."}

            Browser->>Browser: Hide form
            Browser-->>Visitor: Show success: "Thank you! We'll review your application."
        end
    end

    Note over API,DB: Admin review phase (async)
    
    API->>DB: (Later) SELECT a.*, j.Title AS JobTitle<br/>FROM JobApplications a JOIN JobPostings j ON a.JobPostingId=j.Id<br/>WHERE a.Status='New' ORDER BY a.CreatedAt DESC
    DB-->>API: New applications list
    
    Note over API: Admin at /admin/jobs calls:<br/>GET /api/jobs/admin/applications?status=New

    API-->>Browser: Applications list to admin panel
    
    Note over Browser: Admin reviews and updates status
    Browser->>API: PUT /api/jobs/admin/applications/{appId}/status<br/>Body: {status: "Shortlisted", adminNotes: "Strong candidate"}
    
    API->>DB: UPDATE JobApplications<br/>SET Status='Shortlisted', AdminNotes='Strong candidate',<br/>UpdatedAt=UTC WHERE Id={appId}
    DB-->>API: 1 row updated
    API->>DB: SaveChanges() - COMMIT
    DB-->>API: Committed
    API-->>Browser: 200 OK {detail: "Status updated."}
```

---

## 5. Admin Creating a Blog Post with Rich Text

```mermaid
sequenceDiagram
    autonumber
    actor Editor
    participant Browser
    participant TipTap as TipTap Editor (Client Component)
    participant NextJS as Next.js Router
    participant API as .NET API (BlogController)
    participant BlogSvc as BlogService
    participant UoW as Unit of Work
    participant DB as SQLite

    Editor->>Browser: Navigate to /admin/blog/new
    Browser->>NextJS: GET /admin/blog/new

    Note over NextJS: Admin layout checks auth cookie<br/>Verifies role is Admin or Editor<br/>If unauthenticated: redirect to /auth/login

    NextJS-->>Browser: Render new-post form page

    Browser->>API: GET /api/blog/categories
    API->>DB: SELECT * FROM BlogCategories ORDER BY Name
    DB-->>API: Categories[]
    API-->>Browser: BlogCategory[] for category dropdown

    Browser->>TipTap: Initialize TipTap editor with extensions:<br/>Bold, Italic, Heading (H1-H3), BulletList,<br/>OrderedList, Link, Image, CodeBlock, Blockquote

    TipTap-->>Browser: Empty editor rendered with toolbar

    Editor->>Browser: Fill metadata fields:<br/>Title="Getting Started with AI in Enterprise"

    Browser->>Browser: onTitleChange: auto-generate slug<br/>"getting-started-with-ai-in-enterprise"

    Editor->>Browser: Select Category = "Technology"
    Editor->>Browser: Fill Summary = "A practical guide..."
    Editor->>Browser: Fill AuthorName = "Jane Doe"
    Editor->>Browser: Add Tags = "AI, Enterprise, Technology"

    Editor->>TipTap: Type rich text content with headings, bold, lists
    TipTap->>TipTap: Convert keystrokes to ProseMirror document model
    TipTap->>TipTap: Render formatted HTML preview live

    Editor->>TipTap: Click Bold toolbar button on selected text
    TipTap->>TipTap: Apply bold mark to selection<br/>Updates internal doc state

    Editor->>TipTap: Click Image insert button
    TipTap-->>Editor: Show URL input dialog
    Editor->>TipTap: Enter image URL, click Insert
    TipTap->>TipTap: Insert image node into document
    TipTap-->>Browser: Image rendered in editor

    Editor->>Browser: Toggle "Save as Draft" (IsPublished=false)
    Editor->>Browser: Click "Save Post"

    Browser->>Browser: Collect form state:<br/>title, slug, summary, content=editor.getHTML(),<br/>categoryId, authorName, tags, isPublished=false

    Browser->>API: POST /api/blog<br/>Authorization: cookie (HttpOnly)<br/>Body: {title, slug, summary, content, categoryId,<br/>authorName, tags, isPublished=false, ...}

    Note over API: Authentication middleware validates cookie<br/>Authorization checks [Authorize(Roles="Admin,Editor")]

    API->>BlogSvc: CreatePostAsync(post)

    BlogSvc->>BlogSvc: Check slug empty?<br/>slug = "getting-started-with-ai-in-enterprise" (not empty)

    BlogSvc->>BlogSvc: IsPublished=false → do not set PublishedAt

    BlogSvc->>UoW: Blog.AddAsync(post)
    UoW->>DB: INSERT INTO BlogPosts<br/>(Title, Slug, Summary, Content, CategoryId,<br/>AuthorName, Tags, IsPublished=0, PublishedAt=NULL,<br/>ViewCount=0, CreatedAt=UTC, UpdatedAt=UTC)

    alt Slug already exists
        DB-->>UoW: UNIQUE constraint violation
        UoW-->>BlogSvc: Exception
        BlogSvc-->>API: Exception propagates
        Note over API: GlobalExceptionMiddleware catches DbUpdateException<br/>Maps to 409 Conflict response
        API-->>Browser: 409 {detail: "Slug already in use.", error_code: "CONFLICT"}
        Browser-->>Editor: Show: "Modify the slug - it's already taken"
    else Slug unique
        DB-->>UoW: New row with Id assigned
        UoW-->>BlogSvc: Entity tracked

        BlogSvc->>UoW: SaveChangesAsync()
        UoW->>DB: COMMIT transaction
        DB-->>UoW: Saved (ApplicationDbContext auto-set CreatedAt+UpdatedAt)
        UoW-->>BlogSvc: 1 row saved
        BlogSvc-->>API: Created BlogPost with Id

        API-->>Browser: 201 Created<br/>Location: /api/blog/getting-started-with-ai-in-enterprise<br/>Body: full BlogPost JSON

        Browser->>NextJS: router.push("/admin/blog/edit/" + post.id)
        NextJS-->>Browser: Redirect to edit page

        Browser->>API: GET /api/blog/admin/{id} (or GET /api/blog/{slug})
        API->>DB: SELECT * FROM BlogPosts WHERE Id = {id}
        DB-->>API: BlogPost row
        API-->>Browser: BlogPost with all fields

        Browser->>TipTap: Load editor.commands.setContent(post.content)
        TipTap-->>Browser: Editor populated with saved HTML
        Browser-->>Editor: Edit page ready - post saved as draft
    end

    Editor->>Browser: Make additional edits in TipTap
    Editor->>Browser: Toggle IsPublished = true
    Editor->>Browser: Click "Update Post"

    Browser->>API: PUT /api/blog/{id}<br/>Body: {..., isPublished=true}

    API->>BlogSvc: UpdatePostAsync(post)
    BlogSvc->>UoW: Blog.GetByIdAsync(id)
    UoW->>DB: SELECT * FROM BlogPosts WHERE Id = {id}
    DB-->>UoW: Existing row
    
    BlogSvc->>BlogSvc: IsPublished newly true AND PublishedAt null?<br/>→ Set PublishedAt = UtcNow

    BlogSvc->>UoW: Blog.Update(existingPost)
    BlogSvc->>UoW: SaveChangesAsync()
    UoW->>DB: UPDATE BlogPosts SET IsPublished=1, PublishedAt=UTC,<br/>UpdatedAt=UTC, ... WHERE Id={id}
    DB-->>UoW: 1 row updated
    UoW-->>BlogSvc: Saved
    BlogSvc-->>API: Updated BlogPost

    API-->>Browser: 200 OK - Updated BlogPost JSON
    Browser-->>Editor: Show "Published" badge on post
    Note over Browser,DB: Post now visible on GET /api/blog (public listing)
```

---

## 6. Docker Health Check Sequence

```mermaid
sequenceDiagram
    autonumber
    participant Daemon as Docker Daemon
    participant BContainer as Backend Container (slp-backend)
    participant FContainer as Frontend Container (slp-frontend)
    participant HealthAPI as .NET Health Endpoint (/api/health)
    participant EFCheck as EF Core DB Health Check
    participant SQLite as SQLite Database
    participant FHealth as Next.js Health (HTTP /)
    participant Compose as docker-compose orchestrator

    Note over Daemon: Docker monitors health every 30s<br/>start_period=20s (grace period after start)<br/>timeout=10s, retries=3

    loop Every 30 seconds
        Daemon->>BContainer: Execute health check command:<br/>wget -qO- http://localhost:5062/api/health

        BContainer->>HealthAPI: GET /api/health (loopback)

        Note over HealthAPI: HealthCheckOptions.ResponseWriter:<br/>Aggregates all registered IHealthCheck results

        HealthAPI->>EFCheck: Execute AddDbContextCheck<ApplicationDbContext>
        EFCheck->>SQLite: SELECT 1 (EF Core liveness probe)
        
        alt SQLite responds normally
            SQLite-->>EFCheck: Result: 1 row
            EFCheck-->>HealthAPI: Status=Healthy, Duration=Xms
        else SQLite locked or unavailable
            SQLite-->>EFCheck: Exception or timeout
            EFCheck-->>HealthAPI: Status=Unhealthy, Exception="..."
        end

        HealthAPI->>HealthAPI: Assemble response JSON:<br/>{status: "Healthy" or "Unhealthy",<br/>timestamp: UTC,<br/>version: "1.0.0",<br/>checks: [{name:"database", status, duration, description, exception}]}

        HealthAPI-->>BContainer: 200 OK with JSON body (Healthy)<br/>or 503 Service Unavailable (Unhealthy)
        BContainer-->>Daemon: wget exit code 0 (success) or non-zero (failure)

        alt Health check PASSED
            Daemon->>Daemon: health_status = healthy<br/>Reset consecutive failure count to 0
            Note over Daemon,Compose: Container marked healthy<br/>Dependent services (frontend) can start/stay running
        else Health check FAILED (1st or 2nd time)
            Daemon->>Daemon: Increment consecutive failure count
            Daemon->>Daemon: health_status = starting (if within retries)
            Note over Daemon: Wait 30s for next attempt
        else Health check FAILED 3 consecutive times
            Daemon->>Daemon: health_status = unhealthy
            Daemon->>BContainer: Container stays running (restart policy: unless-stopped)
            Note over Daemon,Compose: restart: unless-stopped triggers container restart
            Daemon->>BContainer: Stop container
            Daemon->>BContainer: Start container (fresh process)
            BContainer->>BContainer: .NET runtime starts
            BContainer->>SQLite: EF Core runs migrations check
            BContainer->>BContainer: SeedData.InitializeAsync runs
            Note over BContainer: start_period=20s: health check paused<br/>during startup grace period
        end
    end

    loop Every 30 seconds (frontend)
        Daemon->>FContainer: Execute health check:<br/>wget -qO- http://localhost:3000

        FContainer->>FHealth: GET / (Next.js server)

        alt Next.js server running
            FHealth-->>FContainer: 200 OK - HTML response
            FContainer-->>Daemon: wget exit code 0
            Daemon->>Daemon: Frontend health_status = healthy
        else Next.js crashed or unresponsive
            FHealth-->>FContainer: Connection refused or timeout
            FContainer-->>Daemon: wget exit code non-zero
            Daemon->>Daemon: Increment failure count
            
            alt 3 consecutive failures
                Daemon->>FContainer: Restart frontend container
                Note over FContainer: depends_on backend condition: service_healthy<br/>Frontend waits for backend healthy before starting
                FContainer->>BContainer: Verify backend healthy
                BContainer-->>FContainer: Backend confirmed healthy
                FContainer->>FContainer: npm start / node server.js
                FContainer-->>Daemon: Process running
            end
        end
    end

    Note over Daemon,Compose: Nginx container has no health check defined<br/>It depends_on: frontend and backend<br/>nginx:1.25-alpine restart: unless-stopped

    Daemon->>Compose: docker compose ps - show health status
    Compose-->>Daemon: slp-backend: healthy<br/>slp-frontend: healthy<br/>slp-nginx: running
```

