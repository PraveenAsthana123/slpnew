# Low-Level Design (LLD) — SLP Systems Portal

**Version:** 1.0  
**Date:** 2026-03-03  
**Stack:** .NET 8 ASP.NET Core + Next.js 13+ (App Router) + SQLite + SignalR  

---

## Table of Contents

1. [Backend Class and Interface Design](#1-backend-class-and-interface-design)
2. [Database Schema](#2-database-schema)
3. [Entity Relationship Diagram](#3-entity-relationship-diagram)
4. [API Endpoint Specifications](#4-api-endpoint-specifications)
5. [Frontend Component Tree](#5-frontend-component-tree)
6. [State Management Approach](#6-state-management-approach)
7. [Key Algorithm Descriptions](#7-key-algorithm-descriptions)
8. [Error Handling Flow](#8-error-handling-flow)

---

## 1. Backend Class and Interface Design

### 1.1 Generic Repository Interface

```
IRepository<T>
├── GetByIdAsync(int id)            → Task<T?>
├── GetAllAsync()                   → Task<IEnumerable<T>>
├── FindAsync(Expression predicate) → Task<IEnumerable<T>>
├── FirstOrDefaultAsync(predicate)  → Task<T?>
├── CountAsync(predicate?)          → Task<int>
├── AnyAsync(predicate?)            → Task<bool>
├── AddAsync(T entity)              → Task
├── Update(T entity)                → void
├── Remove(T entity)                → void
└── Query()                         → IQueryable<T>
```

### 1.2 Domain-Specific Repository Interfaces

```
IBlogRepository : IRepository<BlogPost>
├── GetBySlugAsync(slug)                                      → Task<BlogPost?>
├── GetPublishedAsync(page, pageSize, categoryId?, tag?, search?) 
│   → Task<(IEnumerable<BlogPost>, int Total)>
├── GetRecentAsync(count)                                     → Task<IEnumerable<BlogPost>>
├── GetCategoriesAsync()                                      → Task<IEnumerable<BlogCategory>>
├── GetCategoryBySlugAsync(slug)                              → Task<BlogCategory?>
├── GetCategoryByIdAsync(id)                                  → Task<BlogCategory?>
├── AddCategoryAsync(category)                                → Task
├── UpdateCategory(category)                                  → void
├── RemoveCategory(category)                                  → void
├── GetPostCountByCategoryAsync(categoryId)                   → Task<int>
└── IncrementViewCountAsync(id)                               → Task

IChatMessageRepository : IRepository<ChatMessage>
├── GetBySessionIdAsync(sessionId)   → Task<IEnumerable<ChatMessage>>
├── GetActiveSessionIdsAsync(hours)  → Task<IEnumerable<string>>
├── GetUnreadCountAsync()            → Task<int>
└── MarkSessionReadAsync(sessionId)  → Task

IChatRequestRepository : IRepository<ChatRequest>
├── GetUnresolvedAsync()             → Task<IEnumerable<ChatRequest>>
└── GetByPriorityAsync(priority)     → Task<IEnumerable<ChatRequest>>

IContactRepository : IRepository<ContactMessage>
├── GetUnreadAsync()                 → Task<IEnumerable<ContactMessage>>
├── GetUnreadCountAsync()            → Task<int>
└── GetArchivedAsync()               → Task<IEnumerable<ContactMessage>>

INewsletterRepository : IRepository<NewsletterSubscriber>
├── GetByEmailAsync(email)           → Task<NewsletterSubscriber?>
├── GetActiveAsync()                 → Task<IEnumerable<NewsletterSubscriber>>
├── GetByTokenAsync(token)           → Task<NewsletterSubscriber?>
└── GetActiveCountAsync()            → Task<int>

IAuditLogRepository : IRepository<AuditLog>
├── GetByEntityAsync(entityType, entityId)  → Task<IEnumerable<AuditLog>>
├── GetByUserAsync(userId)                  → Task<IEnumerable<AuditLog>>
└── GetPagedAsync(page, pageSize, filters)  → Task<(IEnumerable<AuditLog>, int)>
```

### 1.3 Unit of Work

```
IUnitOfWork : IDisposable
├── Services           → IServiceRepository
├── Blog               → IBlogRepository
├── Testimonials       → ITestimonialRepository
├── CaseStudies        → ICaseStudyRepository
├── Contacts           → IContactRepository
├── Newsletter         → INewsletterRepository
├── VideoDemos         → IVideoDemoRepository
├── IndustrySolutions  → IIndustrySolutionRepository
├── TeamMembers        → ITeamMemberRepository
├── SiteSettings       → ISiteSettingsRepository
├── ChatRequests       → IChatRequestRepository
├── AuditLogs          → IAuditLogRepository
├── ChatMessages       → IChatMessageRepository
└── SaveChangesAsync() → Task<int>

UnitOfWork (concrete)
└── Wraps ApplicationDbContext; all repositories share one DbContext instance per request
```

### 1.4 Service Interfaces

```
IBlogService
├── GetPublishedPostsAsync(page, pageSize, categoryId?, tag?, search?)
│   → Task<(IEnumerable<BlogPost>, int Total)>
├── GetPostBySlugAsync(slug)           → Task<BlogPost?>   [increments ViewCount]
├── GetRecentPostsAsync(count)         → Task<IEnumerable<BlogPost>>
├── GetCategoriesAsync()               → Task<IEnumerable<BlogCategory>>
├── GetCategoryBySlugAsync(slug)       → Task<BlogCategory?>
├── CreatePostAsync(post)              → Task<BlogPost>    [generates slug if empty]
├── UpdatePostAsync(post)              → Task<BlogPost>    [sets PublishedAt if toggled]
├── DeletePostAsync(id)                → Task
├── CreateCategoryAsync(name,slug,desc)→ Task<BlogCategory>
├── UpdateCategoryAsync(id,...)        → Task<BlogCategory>
└── DeleteCategoryAsync(id)            → Task  [throws ValidationException if posts exist]

IContactService
├── SubmitMessageAsync(message)        → Task<ContactMessage>  [sends email notification]
├── GetAllMessagesAsync()              → Task<IEnumerable<ContactMessage>>
├── GetMessageByIdAsync(id)            → Task<ContactMessage?>
├── MarkAsReadAsync(id)                → Task
├── ArchiveMessageAsync(id)            → Task
└── GetUnreadCountAsync()              → Task<int>

INewsletterService
├── SubscribeAsync(email, name?)       → Task<(bool success, string message)>
├── UnsubscribeAsync(token)            → Task<bool>
├── GetSubscribersAsync()              → Task<IEnumerable<NewsletterSubscriber>>
└── GetSubscriberCountAsync()          → Task<int>

IEmailService
├── SendContactNotificationAsync(message)  → Task
├── SendNewsletterWelcomeAsync(email,token) → Task
└── SendJobApplicationAckAsync(app)        → Task

ISiteService
└── GetSettingsAsync()                 → Task<SiteSettings>
```

### 1.5 SignalR Hub — ChatHub

```
ChatHub : Hub
│
├── JoinSession(sessionId, name, email)
│   ├── AddToGroupAsync(ConnectionId, "session-{sessionId}")
│   └── Clients.Group("admins").SendAsync("CustomerConnected", {sessionId, name, email, connectedAt})
│
├── JoinAdminRoom()
│   └── AddToGroupAsync(ConnectionId, "admins")
│
├── SendMessage(sessionId, name, email, content, customerId?)
│   ├── Creates ChatMessage {IsFromAdmin=false, IsRead=false}
│   ├── uow.ChatMessages.AddAsync(msg)
│   ├── uow.SaveChangesAsync()
│   ├── Clients.Group("admins").SendAsync("ReceiveMessage", payload)
│   └── Clients.Group("session-{sessionId}").SendAsync("ReceiveMessage", payload)
│
├── AdminReply(sessionId, adminName, content)
│   ├── Creates ChatMessage {IsFromAdmin=true, IsRead=true}
│   ├── uow.ChatMessages.AddAsync(msg)
│   ├── uow.SaveChangesAsync()
│   ├── Clients.Group("session-{sessionId}").SendAsync("ReceiveMessage", payload)
│   └── Clients.Group("admins").SendAsync("ReceiveMessage", payload)
│
├── MarkRead(sessionId)
│   ├── uow.ChatMessages.MarkSessionReadAsync(sessionId)
│   └── uow.SaveChangesAsync()
│
└── OnDisconnectedAsync(exception?)
    └── base.OnDisconnectedAsync(exception)
```

### 1.6 Middleware Stack (execution order)

```
HTTP Request
     |
     v
CorrelationIdMiddleware         ← injects X-Correlation-Id into Items + response header
     |
     v
GlobalExceptionMiddleware       ← wraps entire pipeline in try/catch; maps exceptions to JSON
     |
     v
SecurityHeadersMiddleware       ← adds X-Frame-Options, X-Content-Type-Options, etc.
     |
     v
RateLimitingMiddleware          ← per-IP sliding window; returns 429 with Retry-After
     |
     v
UseHttpsRedirection
UseStaticFiles
UseRouting
UseCors("NextJsPolicy")
UseAuthentication
UseAuthorization
     |
     v
ApiRequestTrackingMiddleware    ← logs Method, Path, StatusCode, DurationMs, UserId to DB
     |
     v
SerilogRequestLogging
     |
     v
MapControllers / MapHub
     |
     v
Controller / Hub action
```

### 1.7 ApplicationDbContext

```
ApplicationDbContext : IdentityDbContext<IdentityUser>
│
├── DbSets: Services, Testimonials, CaseStudies, BlogPosts, BlogCategories,
│           TeamMembers, ContactMessages, NewsletterSubscribers, VideoDemos,
│           IndustrySolutions, SiteSettings, ChatRequests, AuditLogs,
│           ApiRequestLogs, ChatMessages, JobPostings, JobApplications
│
├── OnModelCreating(builder)
│   ├── Unique indexes: Service.Slug, CaseStudy.Slug, BlogPost.Slug,
│   │                   BlogCategory.Slug, IndustrySolution.Slug,
│   │                   NewsletterSubscriber.Email, NewsletterSubscriber.Token,
│   │                   JobPosting.Slug
│   ├── BlogPost → BlogCategory (many-to-one, DeleteBehavior.Restrict)
│   ├── JobApplication → JobPosting (many-to-one, DeleteBehavior.Cascade)
│   └── Performance indexes on AuditLog, ApiRequestLog, ChatMessage, JobPosting
│
└── SaveChangesAsync()
    └── Auto-sets CreatedAt/UpdatedAt on all BaseEntity subclasses via ChangeTracker
```

### 1.8 Exception Hierarchy

```
AppException (base, abstract)
├── StatusCode: int
├── ErrorCode: string
│
├── NotFoundException          (404, "NOT_FOUND")
├── ValidationException        (400, "VALIDATION_ERROR")
│   └── Errors: object?         [field-level errors dict]
├── ConflictException          (409, "CONFLICT")
├── UnauthorizedException      (401, "UNAUTHORIZED")
└── ForbiddenException         (403, "FORBIDDEN")
```

---

## 2. Database Schema

> All tables inherit `Id INTEGER PK`, `CreatedAt DATETIME NOT NULL`, `UpdatedAt DATETIME NOT NULL` from BaseEntity unless noted. ASP.NET Identity tables are managed by EF Core.

### 2.1 BlogCategories

```
+------------------+---------------+----------+-------------------+
| Column           | Type          | Nullable | Constraints       |
+------------------+---------------+----------+-------------------+
| Id               | INTEGER       | NO       | PRIMARY KEY       |
| Name             | NVARCHAR(50)  | NO       |                   |
| Slug             | NVARCHAR(50)  | NO       | UNIQUE INDEX      |
| Description      | NVARCHAR(500) | YES      |                   |
| CreatedAt        | DATETIME      | NO       |                   |
| UpdatedAt        | DATETIME      | NO       |                   |
+------------------+---------------+----------+-------------------+
```

### 2.2 BlogPosts

```
+------------------+---------------+----------+----------------------------+
| Column           | Type          | Nullable | Constraints                |
+------------------+---------------+----------+----------------------------+
| Id               | INTEGER       | NO       | PRIMARY KEY                |
| Title            | NVARCHAR(200) | NO       |                            |
| Slug             | NVARCHAR(200) | NO       | UNIQUE INDEX               |
| Summary          | NVARCHAR(500) | NO       |                            |
| Content          | TEXT          | NO       |                            |
| FeaturedImageUrl | NVARCHAR(500) | YES      |                            |
| CategoryId       | INTEGER       | NO       | FK → BlogCategories(Id)    |
|                  |               |          | DeleteBehavior.Restrict    |
| AuthorName       | NVARCHAR(100) | NO       |                            |
| Tags             | NVARCHAR(500) | YES      | comma-separated            |
| IsPublished      | BOOLEAN       | NO       | DEFAULT 0                  |
| PublishedAt      | DATETIME      | YES      |                            |
| ViewCount        | INTEGER       | NO       | DEFAULT 0                  |
| MetaTitle        | NVARCHAR(200) | YES      |                            |
| MetaDescription  | NVARCHAR(500) | YES      |                            |
| CreatedAt        | DATETIME      | NO       |                            |
| UpdatedAt        | DATETIME      | NO       |                            |
+------------------+---------------+----------+----------------------------+
```

### 2.3 Services

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY       |
| Title             | NVARCHAR(100) | NO       |                   |
| ShortDescription  | NVARCHAR(500) | NO       |                   |
| FullDescription   | TEXT          | NO       |                   |
| IconSvg           | TEXT          | NO       |                   |
| Slug              | NVARCHAR(100) | NO       | UNIQUE INDEX      |
| Category          | NVARCHAR(50)  | NO       |                   |
| Features          | TEXT          | NO       | JSON array        |
| SortOrder         | INTEGER       | NO       | DEFAULT 0         |
| IsActive          | BOOLEAN       | NO       | DEFAULT 1         |
| IsFeatured        | BOOLEAN       | NO       | DEFAULT 0         |
| CreatedAt         | DATETIME      | NO       |                   |
| UpdatedAt         | DATETIME      | NO       |                   |
+-------------------+---------------+----------+-------------------+
```

### 2.4 CaseStudies

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY       |
| Title             | NVARCHAR(200) | NO       |                   |
| Description       | TEXT          | NO       |                   |
| FullContent       | TEXT          | NO       |                   |
| Tag               | NVARCHAR(50)  | NO       |                   |
| GradientFrom      | NVARCHAR(20)  | NO       |                   |
| GradientTo        | NVARCHAR(20)  | NO       |                   |
| IconSvg           | TEXT          | NO       |                   |
| Slug              | NVARCHAR(200) | NO       | UNIQUE INDEX      |
| IsActive          | BOOLEAN       | NO       | DEFAULT 1         |
| SortOrder         | INTEGER       | NO       |                   |
| CreatedAt         | DATETIME      | NO       |                   |
| UpdatedAt         | DATETIME      | NO       |                   |
+-------------------+---------------+----------+-------------------+
```

### 2.5 TeamMembers

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY       |
| Name              | NVARCHAR(100) | NO       |                   |
| Title             | NVARCHAR(100) | NO       |                   |
| Bio               | TEXT          | NO       |                   |
| ImageUrl          | NVARCHAR(500) | YES      |                   |
| SortOrder         | INTEGER       | NO       |                   |
| IsActive          | BOOLEAN       | NO       | DEFAULT 1         |
| CreatedAt         | DATETIME      | NO       |                   |
| UpdatedAt         | DATETIME      | NO       |                   |
+-------------------+---------------+----------+-------------------+
```

### 2.6 Testimonials

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY       |
| AuthorName        | NVARCHAR(100) | NO       |                   |
| AuthorTitle       | NVARCHAR(100) | NO       |                   |
| Company           | NVARCHAR(100) | NO       |                   |
| Quote             | TEXT          | NO       |                   |
| Initials          | NVARCHAR(5)   | NO       |                   |
| Rating            | INTEGER       | NO       | DEFAULT 5         |
| IsActive          | BOOLEAN       | NO       | DEFAULT 1         |
| SortOrder         | INTEGER       | NO       |                   |
| CreatedAt         | DATETIME      | NO       |                   |
| UpdatedAt         | DATETIME      | NO       |                   |
+-------------------+---------------+----------+-------------------+
```

### 2.7 ContactMessages

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY       |
| Name              | NVARCHAR(100) | NO       |                   |
| Email             | NVARCHAR(200) | NO       |                   |
| Phone             | NVARCHAR(30)  | YES      |                   |
| Company           | NVARCHAR(100) | YES      |                   |
| Subject           | NVARCHAR(200) | NO       |                   |
| Message           | TEXT          | NO       |                   |
| ServiceInterest   | NVARCHAR(100) | YES      |                   |
| IsRead            | BOOLEAN       | NO       | DEFAULT 0         |
| IsArchived        | BOOLEAN       | NO       | DEFAULT 0         |
| RepliedAt         | DATETIME      | YES      |                   |
| CreatedAt         | DATETIME      | NO       |                   |
| UpdatedAt         | DATETIME      | NO       |                   |
+-------------------+---------------+----------+-------------------+
```

### 2.8 NewsletterSubscribers

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY       |
| Email             | NVARCHAR(200) | NO       | UNIQUE INDEX      |
| Name              | NVARCHAR(100) | YES      |                   |
| IsActive          | BOOLEAN       | NO       | DEFAULT 1         |
| Token             | NVARCHAR(100) | NO       | UNIQUE INDEX      |
| SubscribedAt      | DATETIME      | NO       |                   |
| UnsubscribedAt    | DATETIME      | YES      |                   |
| CreatedAt         | DATETIME      | NO       |                   |
| UpdatedAt         | DATETIME      | NO       |                   |
+-------------------+---------------+----------+-------------------+
```

### 2.9 ChatMessages

```
+-------------------+---------------+----------+--------------------------------+
| Column            | Type          | Nullable | Constraints                    |
+-------------------+---------------+----------+--------------------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY                    |
| SessionId         | NVARCHAR(100) | NO       | INDEX (chat lookup)            |
| SenderName        | NVARCHAR(100) | NO       |                                |
| SenderEmail       | NVARCHAR(200) | YES      |                                |
| Content           | TEXT          | NO       |                                |
| IsFromAdmin       | BOOLEAN       | NO       |                                |
| IsRead            | BOOLEAN       | NO       | DEFAULT 0                      |
| CustomerId        | NVARCHAR(450) | YES      | INDEX; FK → AspNetUsers(Id)    |
| CreatedAt         | DATETIME      | NO       | INDEX                          |
| UpdatedAt         | DATETIME      | NO       |                                |
+-------------------+---------------+----------+--------------------------------+
```

### 2.10 ChatRequests

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY       |
| Name              | NVARCHAR(100) | NO       |                   |
| Email             | NVARCHAR(200) | NO       |                   |
| Phone             | NVARCHAR(30)  | YES      |                   |
| Company           | NVARCHAR(100) | YES      |                   |
| RequestType       | NVARCHAR(100) | NO       |                   |
| Message           | TEXT          | NO       |                   |
| ServiceInterest   | NVARCHAR(100) | YES      |                   |
| Priority          | NVARCHAR(50)  | YES      | DEFAULT 'Normal'  |
| IsResolved        | BOOLEAN       | NO       | DEFAULT 0         |
| AdminNotes        | NVARCHAR(500) | YES      |                   |
| ResolvedAt        | DATETIME      | YES      |                   |
| AssignedTo        | NVARCHAR(100) | YES      |                   |
| CreatedAt         | DATETIME      | NO       |                   |
| UpdatedAt         | DATETIME      | NO       |                   |
+-------------------+---------------+----------+-------------------+
```

### 2.11 JobPostings

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY       |
| Title             | NVARCHAR(200) | NO       |                   |
| Slug              | NVARCHAR(200) | NO       | UNIQUE INDEX      |
| Department        | NVARCHAR(100) | NO       | INDEX             |
| Location          | NVARCHAR(100) | NO       |                   |
| EmploymentType    | NVARCHAR(50)  | NO       | DEFAULT 'Full-Time'|
| SalaryRange       | NVARCHAR(100) | YES      |                   |
| Description       | TEXT          | NO       | Rich HTML         |
| Requirements      | TEXT          | YES      | Rich HTML         |
| NiceToHave        | TEXT          | YES      | Rich HTML         |
| Summary           | NVARCHAR(500) | YES      |                   |
| IsActive          | BOOLEAN       | NO       | DEFAULT 1; INDEX  |
| SortOrder         | INTEGER       | NO       |                   |
| ApplicationCount  | INTEGER       | NO       | DEFAULT 0         |
| CreatedAt         | DATETIME      | NO       |                   |
| UpdatedAt         | DATETIME      | NO       |                   |
+-------------------+---------------+----------+-------------------+
```

### 2.12 JobApplications

```
+-------------------+---------------+----------+-------------------------------+
| Column            | Type          | Nullable | Constraints                   |
+-------------------+---------------+----------+-------------------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY                   |
| JobPostingId      | INTEGER       | NO       | FK → JobPostings(Id) CASCADE  |
|                   |               |          | INDEX                         |
| Name              | NVARCHAR(100) | NO       |                               |
| Email             | NVARCHAR(200) | NO       |                               |
| Phone             | NVARCHAR(30)  | YES      |                               |
| LinkedInUrl       | NVARCHAR(200) | YES      |                               |
| PortfolioUrl      | NVARCHAR(200) | YES      |                               |
| CoverLetter       | TEXT          | YES      |                               |
| AdminNotes        | NVARCHAR(500) | YES      |                               |
| Status            | NVARCHAR(50)  | NO       | DEFAULT 'New'; INDEX          |
|                   |               |          | Values: New/Reviewed/         |
|                   |               |          | Shortlisted/Rejected          |
| CreatedAt         | DATETIME      | NO       |                               |
| UpdatedAt         | DATETIME      | NO       |                               |
+-------------------+---------------+----------+-------------------------------+
```

### 2.13 AuditLogs

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY       |
| Action            | NVARCHAR(100) | NO       | INDEX             |
| EntityType        | NVARCHAR(100) | NO       | INDEX             |
| EntityId          | INTEGER       | YES      |                   |
| UserId            | NVARCHAR(450) | YES      |                   |
| UserEmail         | NVARCHAR(256) | YES      |                   |
| Details           | TEXT          | YES      | JSON old/new vals |
| IpAddress         | NVARCHAR(45)  | YES      |                   |
| CorrelationId     | NVARCHAR(36)  | YES      |                   |
| CreatedAt         | DATETIME      | NO       | INDEX             |
| UpdatedAt         | DATETIME      | NO       |                   |
+-------------------+---------------+----------+-------------------+
Auto-purged after 90 days by DataCleanupService
```

### 2.14 ApiRequestLogs

```
+-------------------+----------------+----------+-------------------+
| Column            | Type           | Nullable | Constraints       |
+-------------------+----------------+----------+-------------------+
| Id                | INTEGER        | NO       | PRIMARY KEY       |
| Method            | NVARCHAR(10)   | NO       |                   |
| Path              | NVARCHAR(2048) | NO       | INDEX             |
| StatusCode        | INTEGER        | NO       | INDEX             |
| DurationMs        | BIGINT         | NO       |                   |
| ClientIp          | NVARCHAR(45)   | YES      |                   |
| UserAgent         | NVARCHAR(512)  | YES      |                   |
| UserId            | NVARCHAR(450)  | YES      |                   |
| CorrelationId     | NVARCHAR(36)   | YES      |                   |
| QueryString       | NVARCHAR(2048) | YES      |                   |
| CreatedAt         | DATETIME       | NO       | INDEX             |
| UpdatedAt         | DATETIME       | NO       |                   |
+-------------------+----------------+----------+-------------------+
Auto-purged after 30 days by DataCleanupService
```

### 2.15 SiteSettings (singleton)

```
+-------------------+---------------+----------+-------------------+
| Column            | Type          | Nullable | Constraints       |
+-------------------+---------------+----------+-------------------+
| Id                | INTEGER       | NO       | PRIMARY KEY (=1)  |
| CompanyName       | NVARCHAR(100) | NO       |                   |
| Tagline           | NVARCHAR(200) | NO       |                   |
| Description       | TEXT          | NO       |                   |
| Phone             | NVARCHAR(30)  | NO       |                   |
| Email             | NVARCHAR(200) | NO       |                   |
| Address           | TEXT          | NO       |                   |
| FacebookUrl       | NVARCHAR(500) | YES      |                   |
| TwitterUrl        | NVARCHAR(500) | YES      |                   |
| LinkedInUrl       | NVARCHAR(500) | YES      |                   |
| GoogleMapsEmbed   | TEXT          | YES      |                   |
| SmtpHost          | NVARCHAR(200) | YES      |                   |
| SmtpPort          | INTEGER       | NO       | DEFAULT 587       |
| SmtpUsername      | NVARCHAR(200) | YES      |                   |
| SmtpPassword      | NVARCHAR(200) | YES      | stored encrypted  |
| NewsletterEnabled | BOOLEAN       | NO       | DEFAULT 0         |
+-------------------+---------------+----------+-------------------+
```

### 2.16 ASP.NET Identity Tables (managed by EF Core)

```
AspNetUsers          — Id (GUID), UserName, Email, PasswordHash, ...
AspNetRoles          — Id (GUID), Name: Admin | Editor | HR | Sales | Customer
AspNetUserRoles      — UserId FK, RoleId FK
AspNetUserClaims     — UserId FK, ClaimType, ClaimValue (e.g. DisplayName for customers)
AspNetUserLogins     — external login providers
AspNetUserTokens     — token storage
```

---

## 3. Entity Relationship Diagram

```
+----------------+       +-------------------+
|  BlogCategory  |1     *|     BlogPost      |
|----------------|<------|-------------------|
| Id (PK)        |       | Id (PK)           |
| Name           |       | Title             |
| Slug (UNIQUE)  |       | Slug (UNIQUE)     |
| Description    |       | Summary           |
+----------------+       | Content           |
                         | CategoryId (FK)   |
                         | AuthorName        |
                         | Tags              |
                         | IsPublished       |
                         | PublishedAt       |
                         | ViewCount         |
                         +-------------------+

+----------------+       +-------------------+
|  JobPosting    |1     *|  JobApplication   |
|----------------|<------|-------------------|
| Id (PK)        |       | Id (PK)           |
| Title          |       | JobPostingId (FK) |
| Slug (UNIQUE)  |       | Name              |
| Department     |       | Email             |
| Location       |       | Phone             |
| EmploymentType |       | LinkedInUrl       |
| IsActive       |       | CoverLetter       |
| SortOrder      |       | Status            |
+----------------+       | AdminNotes        |
                         +-------------------+

+----------------+       +-------------------+
|  AspNetUsers   |1     *|   ChatMessage     |
|----------------|<------|-------------------|
| Id (GUID, PK)  |       | Id (PK)           |
| Email          |       | SessionId (INDEX) |
| UserName       |       | SenderName        |
+----------------+       | Content           |
                         | IsFromAdmin       |
                         | IsRead            |
                         | CustomerId (FK?)  |
                         +-------------------+

Standalone tables (no FK relationships):
  Services, CaseStudies, Testimonials, TeamMembers,
  ContactMessages, NewsletterSubscribers, VideoDemos,
  IndustrySolutions, ChatRequests, AuditLogs,
  ApiRequestLogs, SiteSettings

Identity role assignments:
  AspNetUsers ---< AspNetUserRoles >--- AspNetRoles
  Roles: Admin, Editor, HR, Sales, Customer
```

---

## 4. API Endpoint Specifications

### 4.1 Auth Controller — `POST /api/auth/...`

| Method | Path              | Auth Required | Request Body                          | Success Response                                      | Error Codes           |
|--------|-------------------|---------------|---------------------------------------|-------------------------------------------------------|-----------------------|
| POST   | /api/auth/login   | None          | `{email, password}`                   | 200 `{detail, user:{id,email,userName,roles[]}}`     | 400, 401, 500         |
| POST   | /api/auth/logout  | None          | (empty)                               | 200 `{detail}`                                        | 500                   |
| GET    | /api/auth/me      | Authenticated | —                                     | 200 `{id,email,userName,roles[]}`                    | 401, 500              |

### 4.2 Customer Auth Controller — `POST /api/customer/auth/...`

| Method | Path                       | Auth Required     | Request Body                       | Success Response                              | Error Codes           |
|--------|----------------------------|-------------------|------------------------------------|-----------------------------------------------|-----------------------|
| POST   | /api/customer/auth/register | None             | `{name, email, password}`          | 200 `{detail, user:{id,email,name,roles[]}}` | 400, 409, 500         |
| POST   | /api/customer/auth/login   | None              | `{email, password}`                | 200 `{detail, user:{id,email,name,roles[]}}` | 400, 401, 500         |
| POST   | /api/customer/auth/logout  | None              | (empty)                            | 200 `{detail}`                                | 500                   |
| GET    | /api/customer/auth/me      | Customer role     | —                                  | 200 `{id,email,name,roles[]}`                | 401, 500              |

### 4.3 Blog Controller — `/api/blog`

| Method | Path                     | Auth Required       | Query Params / Body                                         | Success Response                                       | Error Codes       |
|--------|--------------------------|---------------------|-------------------------------------------------------------|--------------------------------------------------------|-------------------|
| GET    | /api/blog                | None                | `?page=1&pageSize=9&categoryId=&tag=&search=`               | 200 `{posts[], total, page, pageSize, totalPages}`    | 500               |
| GET    | /api/blog/recent         | None                | `?count=5`                                                  | 200 `BlogPost[]`                                       | 500               |
| GET    | /api/blog/categories     | None                | —                                                           | 200 `BlogCategory[]`                                   | 500               |
| GET    | /api/blog/{slug}         | None                | —                                                           | 200 `BlogPost`                                         | 404, 500          |
| POST   | /api/blog                | Admin or Editor     | `BlogPost` body                                             | 201 `BlogPost`                                         | 400, 401, 403, 500|
| PUT    | /api/blog/{id}           | Admin or Editor     | `BlogPost` body                                             | 200 `BlogPost`                                         | 400, 401, 403, 404, 500 |
| DELETE | /api/blog/{id}           | Admin               | —                                                           | 204                                                    | 401, 403, 404, 500|
| POST   | /api/blog/categories     | Admin               | `{name, slug, description?}`                                | 201 `BlogCategory`                                     | 400, 401, 403, 409, 500 |
| PUT    | /api/blog/categories/{id}| Admin               | `{name, slug, description?}`                                | 200 `BlogCategory`                                     | 400, 401, 403, 404, 409, 500 |
| DELETE | /api/blog/categories/{id}| Admin               | —                                                           | 204                                                    | 400, 401, 403, 404, 500 |

### 4.4 Jobs Controller — `/api/jobs`

| Method | Path                                    | Auth Required | Query Params / Body                        | Success Response                  | Error Codes       |
|--------|-----------------------------------------|---------------|--------------------------------------------|-----------------------------------|-------------------|
| GET    | /api/jobs                               | None          | `?department=`                             | 200 `JobPosting[]` (public fields)| 500               |
| GET    | /api/jobs/departments                   | None          | —                                          | 200 `string[]`                    | 500               |
| GET    | /api/jobs/slug/{slug}                   | None          | —                                          | 200 `JobPosting`                  | 404, 500          |
| POST   | /api/jobs/{id}/apply                    | None          | `JobApplication` body                      | 200 `{detail}`                    | 400, 404, 500     |
| GET    | /api/jobs/admin/all                     | Admin or HR   | —                                          | 200 `JobPosting[]`                | 401, 403, 500     |
| GET    | /api/jobs/admin/{id}                    | Admin or HR   | —                                          | 200 `JobPosting`                  | 401, 403, 404, 500|
| POST   | /api/jobs                               | Admin or HR   | `JobPosting` body                          | 201 `JobPosting`                  | 400, 401, 403, 500|
| PUT    | /api/jobs/{id}                          | Admin or HR   | `JobPosting` body                          | 200 `JobPosting`                  | 400, 401, 403, 404, 500 |
| DELETE | /api/jobs/{id}                          | Admin         | —                                          | 204                               | 401, 403, 404, 500|
| GET    | /api/jobs/admin/applications            | Admin or HR   | `?jobId=&status=`                          | 200 `ApplicationSummary[]`        | 401, 403, 500     |
| PUT    | /api/jobs/admin/applications/{id}/status| Admin or HR   | `{status, adminNotes?}`                    | 200 `{detail}`                    | 401, 403, 404, 500|

### 4.5 Contact Controller — `/api/contact`

| Method | Path                       | Auth Required  | Request Body / Query            | Success Response              | Error Codes           |
|--------|----------------------------|----------------|---------------------------------|-------------------------------|-----------------------|
| POST   | /api/contact               | None           | `ContactMessage` body           | 201 `ContactMessage`          | 400, 500              |
| GET    | /api/contact               | Admin or Sales | —                               | 200 `ContactMessage[]`        | 401, 403, 500         |
| GET    | /api/contact/{id}          | Admin or Sales | —                               | 200 `ContactMessage`          | 401, 403, 404, 500    |
| PUT    | /api/contact/{id}/read     | Admin or Sales | —                               | 200 `{detail}`                | 401, 403, 404, 500    |
| PUT    | /api/contact/{id}/archive  | Admin or Sales | —                               | 200 `{detail}`                | 401, 403, 404, 500    |
| GET    | /api/contact/unread-count  | Admin or Sales | —                               | 200 `{count}`                 | 401, 403, 500         |

### 4.6 Live Chat Controller — `/api/live-chat`

| Method | Path                              | Auth Required  | Query Params              | Success Response                     | Error Codes        |
|--------|-----------------------------------|----------------|---------------------------|--------------------------------------|--------------------|
| GET    | /api/live-chat/history/{sessionId}| None           | —                         | 200 `ChatMessage[]`                  | 400, 500           |
| GET    | /api/live-chat/sessions           | Admin or Sales | `?hours=24`               | 200 `ChatSession[]`                  | 401, 403, 500      |
| GET    | /api/live-chat/unread-count       | Admin or Sales | —                         | 200 `{count}`                        | 401, 403, 500      |
| GET    | /api/live-chat/customer-sessions  | Customer       | —                         | 200 `{sessionId, messageCount, ...}[]`| 401, 500          |

### 4.7 Admin Dashboard — `/api/admin/dashboard`

| Method | Path                    | Auth Required | Response                                                                                       |
|--------|-------------------------|---------------|-----------------------------------------------------------------------------------------------|
| GET    | /api/admin/dashboard    | Admin         | `{totalServices, totalBlogPosts, totalCaseStudies, unreadMessages, subscriberCount, recentMessages[], recentPosts[]}` |

### 4.8 Users Controller — `/api/admin/users`

| Method | Path                        | Auth Required | Request Body             | Success Response       | Error Codes           |
|--------|-----------------------------|---------------|--------------------------|------------------------|-----------------------|
| GET    | /api/admin/users            | Admin         | —                        | 200 `UserResponse[]`   | 401, 403, 500         |
| POST   | /api/admin/users            | Admin         | `{email, password, role}`| 201 `UserResponse`     | 400, 401, 403, 500    |
| PUT    | /api/admin/users/{id}/roles | Admin         | `{roles[]}`              | 200 `{detail}`         | 400, 401, 403, 404, 500|
| DELETE | /api/admin/users/{id}       | Admin         | —                        | 204                    | 400, 401, 403, 404, 500|

### 4.9 Other Public/Admin Controllers (summary)

| Controller        | Route Prefix          | Key Endpoints                                        | Roles Required          |
|-------------------|-----------------------|------------------------------------------------------|-------------------------|
| ServicesController| /api/services         | GET (all), GET featured, GET /slug/{slug}, GET /category/{cat}, POST, PUT/{id}, DELETE/{id} | Admin for mutations |
| TestimonialsController | /api/testimonials | GET, POST, PUT/{id}, DELETE/{id}                   | Admin for mutations     |
| CaseStudiesController | /api/casestudies  | GET, GET /slug/{slug}, POST, PUT/{id}, DELETE/{id} | Admin for mutations     |
| IndustriesController  | /api/industries   | GET, GET /slug/{slug}, POST, PUT/{id}, DELETE/{id} | Admin for mutations     |
| TeamController        | /api/team         | GET, POST, PUT/{id}, DELETE/{id}                   | Admin for mutations     |
| VideosController      | /api/videos       | GET, GET /category/{cat}, POST, PUT/{id}, DELETE/{id}| Admin for mutations   |
| NewsletterController  | /api/newsletter   | POST /subscribe, POST /unsubscribe/{token}, GET /subscribers, GET /count | Admin for reads |
| HomeController        | /api/home         | GET (full homepage data), GET /settings             | None                    |
| AdminMonitoringController | /api/admin/monitoring | GET /api-requests, GET /api-requests/stats, GET /audit-logs, GET /system-health, GET /logs/recent | Admin |

### 4.10 SignalR Hub — `/hubs/chat`

| Hub Method       | Direction            | Parameters                                      | Side Effects                                                         |
|------------------|----------------------|-------------------------------------------------|----------------------------------------------------------------------|
| JoinSession      | Client → Server      | sessionId, name, email                          | Joins group "session-{sessionId}"; notifies "admins" group           |
| JoinAdminRoom    | Client → Server      | (none)                                          | Joins group "admins"                                                  |
| SendMessage      | Client → Server      | sessionId, name, email, content, customerId?    | Saves to DB; broadcasts to "admins" and "session-{sessionId}"        |
| AdminReply       | Client → Server      | sessionId, adminName, content                   | Saves to DB; sends to "session-{sessionId}" and "admins"             |
| MarkRead         | Client → Server      | sessionId                                       | Updates IsRead=true for all unread customer messages in session      |
| ReceiveMessage   | Server → Client      | payload: {id, sessionId, senderName, content, isFromAdmin, createdAt} | Received by customer group and admins group |
| CustomerConnected| Server → Admins      | {sessionId, name, email, connectedAt}           | Sent when a new customer calls JoinSession                           |

### 4.11 Health Check

| Method | Path        | Auth     | Response                                                                                  |
|--------|-------------|----------|-------------------------------------------------------------------------------------------|
| GET    | /api/health | None     | `{status, timestamp, version, checks:[{name, status, duration, description, exception}]}` |

---

## 5. Frontend Component Tree

```
app/                                     (Next.js App Router root)
│
├── layout.tsx                           Root layout: <html>, fonts, global providers
│   └── LayoutWrapper                    Conditionally renders Navbar + Footer
│       ├── Navbar                       Main navigation, mobile menu, auth state
│       └── Footer                       Links, social, newsletter form
│
├── page.tsx                             Home page (SSR)
│   ├── HeroCarousel                     Auto-rotating banner with CTAs
│   ├── ServiceCarousel                  Featured services horizontal scroll
│   ├── AboutSection                     Company overview
│   ├── CaseStudiesSection               Case study cards
│   ├── IndustriesSection                Industry solution tiles
│   ├── VideoDemoSection                 Embedded video demos
│   ├── TestimonialsSection              Rotating testimonial cards
│   ├── TeamSection                      Team member grid
│   ├── BlogSection                      Recent blog posts
│   └── NewsletterSection               Subscribe form
│
├── blog/
│   ├── page.tsx                         Blog listing (SSR + pagination)
│   │   ├── BlogSearch                   Search + category filter input
│   │   └── Pagination                   Page number nav
│   └── [slug]/page.tsx                  Blog post detail (SSR, increments view count)
│
├── careers/
│   ├── layout.tsx                       Careers layout wrapper (SEO metadata)
│   ├── page.tsx                         Job listings (SSR)
│   │   └── Department filter tabs
│   └── [slug]/page.tsx                  Job detail + application form (CSR form)
│       └── ApplyForm                    Multi-field form: name, email, phone,
│                                        LinkedIn, portfolio, cover letter
│
├── contact/
│   └── page.tsx
│       └── ContactForm                  Validated form → POST /api/contact
│
├── services/[slug]/page.tsx             Service detail (SSR)
├── industries/[slug]/page.tsx           Industry detail (SSR)
│
├── about/page.tsx                       About page (SSR)
│
├── auth/login/page.tsx                  Admin login form → POST /api/auth/login
│
├── customer/
│   ├── layout.tsx                       Customer portal layout; auth guard
│   ├── login/page.tsx                   Customer login form
│   ├── register/page.tsx               Customer registration form
│   ├── dashboard/page.tsx              Customer dashboard: recent chats, quick links
│   ├── chat/page.tsx                   Live chat interface
│   │   └── ChatWidget (embedded)       SignalR session; message thread UI
│   └── blog/
│       ├── page.tsx                    Customer-facing blog listing
│       └── [slug]/page.tsx             Blog post detail
│
└── admin/
    ├── layout.tsx                       Admin layout: sidebar nav, auth guard, role check
    ├── loading.tsx                      Skeleton loader
    ├── error.tsx                        Error boundary
    ├── page.tsx                         Dashboard (stats, recent messages, recent posts)
    ├── blog/
    │   ├── page.tsx                     Blog post list + delete + toggle publish
    │   ├── new/page.tsx                 Create blog post
    │   │   └── RichTextEditor          TipTap-based WYSIWYG editor
    │   ├── edit/[id]/page.tsx          Edit blog post (loads existing data)
    │   └── categories/page.tsx         Category CRUD table
    │       └── AdminTable
    │       └── AdminFormInput
    ├── jobs/page.tsx                   Job postings CRUD + application list + status updates
    ├── messages/page.tsx               Contact messages: list, read, archive
    ├── live-chat/page.tsx              Admin live chat: session list, active conversation
    ├── chat-requests/page.tsx          Structured chat request queue
    ├── newsletter/page.tsx             Subscriber list + count
    ├── users/page.tsx                  User management: create, assign roles, delete
    ├── services/page.tsx               Services CRUD
    ├── casestudies/page.tsx            Case studies CRUD
    ├── team/page.tsx                   Team member CRUD
    ├── testimonials/page.tsx           Testimonials CRUD
    ├── videos/page.tsx                 Video demo CRUD
    ├── settings/page.tsx               Site settings form
    ├── health/page.tsx                 Backend health check display
    ├── api-tracking/page.tsx           API request log table with stats
    ├── audit/page.tsx                  Audit log table
    ├── logs/page.tsx                   Live log tail view
    ├── config/page.tsx                 Runtime config display
    └── docs/page.tsx                   Swagger/API docs embed

components/
├── admin/
│   ├── AdminFormInput                  Labeled input/textarea with validation display
│   ├── AdminTable                      Generic sortable/filterable data table
│   ├── ConfirmModal                    Delete/action confirmation dialog
│   └── StatusBadge                     Colour-coded status chip (New/Reviewed/etc.)
├── blog/
│   ├── BlogSearch                      Debounced search input + category dropdown
│   └── Pagination                      Numbered pages + prev/next
├── chat/
│   └── LiveChatWidget                  Full-screen chat UI; SignalR client; session management
├── contact/
│   └── ContactForm                     Name/email/subject/message with client validation
├── editor/
│   └── RichTextEditor                  TipTap editor wrapper: bold, italic, lists,
│                                       headings, links, images, code blocks
├── home/
│   ├── HeroCarousel                    Auto-advancing slides with fade transition
│   ├── ServiceCarousel                 Horizontal scroll service cards
│   ├── AboutSection                    Text + stats layout
│   ├── CaseStudiesSection              Grid of case study cards with gradient icons
│   ├── IndustriesSection               Industry tile grid with hover effects
│   ├── VideoDemoSection                Embedded YouTube/Vimeo iframes
│   ├── TestimonialsSection             Auto-rotating quote cards with star rating
│   ├── TeamSection                     Team member photo/bio grid
│   ├── BlogSection                     Recent 3 post cards
│   └── NewsletterSection              Email subscribe input
├── layout/
│   ├── Navbar                          Responsive nav: logo, links, mobile hamburger
│   ├── Footer                          Footer grid: links, social, company info
│   └── LayoutWrapper                   Decides whether to show Navbar/Footer
└── ui/
    └── ChatWidget                      Floating chat bubble (visitor-facing)
                                        Opens LiveChatWidget panel on click
```

---

## 6. State Management Approach

### 6.1 Architecture Decision

The frontend uses **React local state + server-side fetching** exclusively. No global state library (Redux/Zustand/Jotai) is used. The rationale is that Next.js 13 App Router Server Components handle most data requirements without client state.

### 6.2 Pattern by Data Type

| Data Type                         | Strategy                                                      |
|-----------------------------------|---------------------------------------------------------------|
| Public page data (SSR)            | `async` Server Components call backend via `fetchApi()` directly; no client state |
| Admin panel data                  | Client Components using `useState` + `useEffect` with `fetchApi()` |
| Authentication state              | Cookie-based; `authApi.getCurrentUser()` called in layouts; stored in component `useState` |
| Customer auth state               | `useState` in `customer/layout.tsx`; re-fetched on each layout mount |
| Live chat messages                | `useState` array in `LiveChatWidget`; appended via SignalR `onmessage` event |
| Rich text editor content          | TipTap editor instance + `useState(html)` in blog edit forms   |
| Form state                        | `useState` per form field; no form library                    |
| Pagination cursors                | URL search params (`router.push()`) for SSR blog listing; `useState` for admin tables |

### 6.3 API Client (`src/lib/api.ts`)

```
fetchApi<T>(endpoint, options)
  ├── Timeout: 30 000 ms via AbortController
  ├── Retry: GET requests retry up to 2 times with exponential backoff (1s, 2s)
  ├── credentials: 'include' → sends auth cookie automatically
  ├── On non-OK response: parses error body and throws ApiError(statusCode, message, errorCode, correlationId)
  └── 4xx errors are not retried (only 5xx + network errors)
```

### 6.4 SignalR Client State (LiveChatWidget)

```
Component state:
  messages: ChatMessage[]   ← populated from GET /api/live-chat/history on mount
  sessionId: string         ← generated once with crypto.randomUUID() or from localStorage
  connected: boolean        ← SignalR hub connection status
  inputText: string         ← controlled textarea

On SignalR "ReceiveMessage" event:
  setMessages(prev => [...prev, newMessage])

On send:
  hubConnection.invoke("SendMessage", sessionId, name, email, inputText, customerId?)
  setInputText("")
```

---

## 7. Key Algorithm Descriptions

### 7.1 Slug Generation

**Location:** `BlogService.GenerateSlug()` and `JobsController.GenerateSlug()`

```
Input:  "My Blog Post: A #1 Guide (2026)"
Output: "my-blog-post-a-1-guide-2026"

Algorithm:
  1. ToLowerInvariant()
  2. Replace common German umlauts: ä→ae, ö→oe, ü→ue, ß→ss
  3. Regex.Replace(@"[^a-z0-9\s-]", "")     ← strip non-alphanumeric except spaces and hyphens
  4. Regex.Replace(@"[\s-]+", "-")           ← collapse multiple spaces/hyphens to single hyphen
  5. Trim('-')                               ← remove leading/trailing hyphens

Edge cases:
  - Empty string → return empty string (guard clause)
  - Uniqueness: not enforced in algorithm; DB unique index raises ConflictException if duplicate
  - Accented non-German characters: stripped by step 3
```

### 7.2 Blog Post Pagination

**Location:** `BlogRepository.GetPublishedAsync()`

```
Inputs: page (1-based), pageSize, categoryId?, tag?, search?

SQL equivalent:
  SELECT * FROM BlogPosts
  WHERE IsPublished = 1
    AND (@categoryId IS NULL OR CategoryId = @categoryId)
    AND (@tag IS NULL OR Tags LIKE '%@tag%')
    AND (@search IS NULL
         OR Title LIKE '%@search%'
         OR Summary LIKE '%@search%'
         OR Content LIKE '%@search%')
  ORDER BY PublishedAt DESC
  OFFSET (@page - 1) * @pageSize ROWS
  FETCH NEXT @pageSize ROWS ONLY

Returns: (IEnumerable<BlogPost>, int Total)
Total is computed via COUNT before pagination so the API can return totalPages.

totalPages = Ceiling(total / pageSize)
```

### 7.3 SignalR Session Management

```
Session ID Lifecycle:
  1. Customer visits site → LiveChatWidget checks localStorage for existing sessionId
  2. If none found: sessionId = crypto.randomUUID() stored in localStorage
  3. On SignalR connect: hub.invoke("JoinSession", sessionId, name, email)
  4. Server adds ConnectionId to SignalR group "session-{sessionId}"
  5. Admins are in group "admins" (joined via JoinAdminRoom on admin panel load)
  6. Message routing:
       Customer sends → server saves to DB → relays to "admins" + "session-{sessionId}"
       Admin replies  → server saves to DB → relays to "session-{sessionId}" + "admins"
  7. On customer disconnect: OnDisconnectedAsync logs event; group membership auto-removed by SignalR
  8. Session "active" definition: has messages in last N hours (configurable, default 24h)
  9. Admin unread badge: COUNT WHERE IsRead=false AND IsFromAdmin=false

Multi-tab support:
  - Both tabs call JoinSession with same sessionId
  - Both ConnectionIds are in "session-{sessionId}" group
  - Echo-back to "session-{sessionId}" ensures both tabs see sent messages
```

### 7.4 Rate Limiting Algorithm

**Location:** `RateLimitingMiddleware`

```
Data structure: ConcurrentDictionary<string IP, ClientRequestInfo>
ClientRequestInfo: { List<DateTime> Requests }

Per request:
  1. clientIp = RemoteIpAddress.ToString()
  2. clientInfo = _clients.GetOrAdd(clientIp, new ClientRequestInfo())
  3. lock(clientInfo):
       a. Remove entries older than _window (sliding window)
       b. If count >= _maxRequests: return 429 with Retry-After: 60
       c. Else: Add DateTime.UtcNow to Requests list
  4. Proceed to next middleware

Default: 100 requests per 60-second window per IP
Configurable via RateLimit:MaxRequests and RateLimit:WindowSeconds in appsettings.json

Note: In-memory only; resets on restart. For distributed deployments, replace with Redis-backed store.
```

### 7.5 Correlation ID Propagation

```
CorrelationIdMiddleware:
  1. Check request header "X-Correlation-Id"
  2. If present: use that value; if absent: generate Guid.NewGuid().ToString("N")
  3. Store in HttpContext.Items["CorrelationId"]
  4. Set response header "X-Correlation-Id" = correlationId
  5. Push to Serilog LogContext.PushProperty("CorrelationId")
     → all log entries for this request automatically include correlation_id

Usage in error responses:
  GlobalExceptionMiddleware reads from HttpContext.Items["CorrelationId"]
  and includes in the error envelope: {"detail","error_code","correlation_id"}
```

### 7.6 Newsletter Token Generation

```
On subscribe:
  token = Guid.NewGuid().ToString("N")   ← 32-char hex, no hyphens
  Stored in NewsletterSubscribers.Token (UNIQUE INDEX)
  Used for unsubscribe link: GET /api/newsletter/unsubscribe/{token}

Unsubscribe:
  1. Look up subscriber by token
  2. If not found → 404
  3. Set IsActive = false, UnsubscribedAt = UtcNow
  4. Save changes
```

### 7.7 Automatic Timestamp Injection

```
ApplicationDbContext.SaveChangesAsync():
  For each ChangeTracker.Entries<BaseEntity>():
    EntityState.Added   → entity.CreatedAt = now; entity.UpdatedAt = now
    EntityState.Modified→ entity.UpdatedAt = now

This ensures all entities always have accurate UTC timestamps without
requiring service-layer code to set them manually.
```

### 7.8 DataCleanupService (Background)

```
Hosted service runs at startup and then on a daily schedule:
  1. Delete AuditLogs WHERE CreatedAt < UtcNow - 90 days
  2. Delete ApiRequestLogs WHERE CreatedAt < UtcNow - 30 days
  3. Log count of deleted rows at INFO level
```

---

## 8. Error Handling Flow

### 8.1 Backend Error Flow

```
HTTP Request
     │
     ▼
CorrelationIdMiddleware  ─── assigns/propagates correlationId
     │
     ▼
GlobalExceptionMiddleware.InvokeAsync()
     │ try {
     ▼
Controller Action
     │
     ├── ModelState.IsValid check
     │   └── if invalid → return BadRequest({detail, error_code="VALIDATION_ERROR", errors})
     │
     ├── Service layer call
     │   ├── Service raises NotFoundException     → bubbles up
     │   ├── Service raises ValidationException   → bubbles up
     │   ├── Service raises ConflictException     → bubbles up
     │   └── Service raises unexpected Exception  → bubbles up
     │
     └── return Ok/Created/NoContent
     │
     } catch (Exception ex) {
     ▼
GlobalExceptionMiddleware.HandleExceptionAsync()
     │
     ├── AppException (NotFoundException, ValidationException, ConflictException)
     │   → statusCode from exception, errorCode from exception
     │   → log WARNING
     │
     ├── KeyNotFoundException
     │   → 404, "NOT_FOUND"
     │   → log WARNING
     │
     ├── UnauthorizedAccessException
     │   → 401, "UNAUTHORIZED"
     │   → log WARNING
     │
     ├── OperationCanceledException
     │   → 499, "REQUEST_CANCELLED"
     │   → log INFO
     │
     └── All other Exception
         → 500, "INTERNAL_ERROR"
         → log ERROR with full stack trace
     │
     ▼
JSON Response:
{
  "detail": "Human-readable message",
  "error_code": "SNAKE_CASE_CODE",
  "correlation_id": "abc123...",
  "errors": { ... }  (optional, ValidationException only)
}
```

### 8.2 Frontend Error Flow

```
fetchApi<T>(endpoint, options)
     │
     ├── AbortController timeout (30s) → throws AbortError
     │
     ├── fetch() network failure → throws Error → retry (GET only, up to 2 times, exp backoff)
     │
     ├── response.ok = false
     │   └── parse error body → throw ApiError(statusCode, detail, error_code, correlation_id)
     │
     └── response.ok = true → return response.json()

Component-level handling:
     │
     ├── try { await someApi.call() }
     │   catch (err) {
     │     if (err instanceof ApiError) {
     │       if (err.statusCode === 401) → redirect to login
     │       if (err.statusCode === 403) → show "Access denied" toast
     │       if (err.statusCode === 404) → show "Not found" message
     │       if (err.statusCode === 409) → show conflict message (e.g. "Slug already exists")
     │       else                        → show err.message in UI error state
     │     }
     │     else → show generic "An unexpected error occurred"
     │   }
     │
     └── admin/error.tsx — catches unhandled errors in admin layout subtree (Next.js error boundary)
         Displays error message + correlation_id if available for support reference
```

### 8.3 SignalR Error Handling

```
Hub client error:
  hubConnection.onclose((error) => {
    setConnected(false)
    // attempt reconnect after 2s, 5s, 10s (exponential with jitter)
  })

Hub server error (ChatHub methods):
  - Exceptions in SendMessage/AdminReply do NOT crash the hub
  - If uow.SaveChangesAsync() throws → message is lost silently (logged server-side)
  - Future improvement: wrap in try/catch, invoke "MessageFailed" back to caller
```

### 8.4 Identity / Auth Error Mapping

| Scenario                          | HTTP Status | error_code             |
|-----------------------------------|-------------|------------------------|
| Wrong email or password           | 401         | INVALID_CREDENTIALS    |
| Account locked out (5 failures)   | 401         | ACCOUNT_LOCKED         |
| Account not allowed to sign in    | 401         | SIGN_IN_NOT_ALLOWED    |
| Missing auth cookie               | 401         | (ASP.NET Identity redirects to 401 via OnRedirectToLogin) |
| Insufficient role                 | 403         | (ASP.NET Identity redirects to 403 via OnRedirectToAccessDenied) |
| Self-deletion attempt             | 400         | SELF_DELETE_FORBIDDEN  |
| Email already registered          | 409         | EMAIL_TAKEN            |
| Password policy violation         | 400         | REGISTRATION_FAILED    |

