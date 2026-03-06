# Database Documentation — SLP Systems Portal

> **Database**: SQLite via Entity Framework Core 8
> **Connection**: `Data Source=slpsystems.db`
> **ORM**: EF Core 8 with Code-First migrations

---

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Schema Reference](#schema-reference)
- [Indexes](#indexes)
- [Migration History](#migration-history)
- [Data Seeding](#data-seeding)
- [Data Retention](#data-retention)
- [Query Patterns](#query-patterns)
- [PostgreSQL Migration Guide](#postgresql-migration-guide)

---

## Overview

| Property | Value |
|----------|-------|
| Engine | SQLite 3 |
| ORM | Entity Framework Core 8 |
| DbContext | `ApplicationDbContext` (inherits `IdentityDbContext<IdentityUser>`) |
| File | `slpsystems.db` (project root) |
| Auth | ASP.NET Core Identity (built-in tables) |
| Custom Tables | 17 |
| Identity Tables | 7 |
| Total Tables | 24 |

### Why SQLite?

- **Zero infrastructure** — no database server to install or manage
- **Single-file** — easy backup (`cp slpsystems.db backup.db`)
- **Fast reads** — WAL mode enables concurrent readers
- **Migration-ready** — EF Core abstracts the DB; switching to PostgreSQL requires only a connection string change
- **Ideal for MVP** — no external dependencies, works on any machine

---

## Configuration

### SQLite Pragmas

```csharp
// ApplicationDbContext.cs — OnModelCreating
builder.HasAnnotation("Sqlite:WalMode", true);
```

| Pragma | Value | Purpose |
|--------|-------|---------|
| `journal_mode` | WAL | Write-Ahead Logging — concurrent reads during writes |
| `busy_timeout` | 5000ms (default) | Wait before returning SQLITE_BUSY |

### Auto-Timestamps

Every entity inheriting `BaseEntity` gets automatic timestamps:

```csharp
// SaveChangesAsync override
foreach (var entry in ChangeTracker.Entries<BaseEntity>())
{
    if (entry.State == EntityState.Added)
        entry.Entity.CreatedAt = DateTime.UtcNow;
    entry.Entity.UpdatedAt = DateTime.UtcNow;
}
```

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────┐
│  BlogCategory   │ 1───N │    BlogPost      │
│─────────────────│       │──────────────────│
│ Id (PK)         │       │ Id (PK)          │
│ Name            │       │ CategoryId (FK)  │
│ Slug (UNIQUE)   │       │ Title            │
│ Description     │       │ Slug (UNIQUE)    │
└─────────────────┘       │ Content          │
                          │ IsPublished      │
                          └──────────────────┘

┌─────────────────┐       ┌──────────────────┐
│   JobPosting    │ 1───N │  JobApplication  │
│─────────────────│       │──────────────────│
│ Id (PK)         │       │ Id (PK)          │
│ Title           │       │ JobPostingId (FK)│
│ Slug (UNIQUE)   │       │ Name             │
│ Department      │       │ Email            │
│ Description     │       │ Status           │
│ IsActive        │       │ CoverLetter      │
└─────────────────┘       └──────────────────┘

┌─────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  AspNetUsers    │       │  ChatMessage     │       │   SiteSettings   │
│─────────────────│       │──────────────────│       │──────────────────│
│ Id (PK)         │───┐   │ Id (PK)          │       │ Id (PK)          │
│ UserName        │   └──▷│ CustomerId (FK?) │       │ CompanyName      │
│ Email           │       │ SessionId        │       │ SMTP config      │
│ PasswordHash    │       │ Content          │       │ Social URLs      │
└─────────────────┘       │ IsFromAdmin      │       └──────────────────┘
                          └──────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Service    │  │  CaseStudy   │  │ Testimonial  │  │  TeamMember  │
│──────────────│  │──────────────│  │──────────────│  │──────────────│
│ Slug(UNIQUE) │  │ Slug(UNIQUE) │  │ AuthorName   │  │ Name         │
│ Category     │  │ Tag          │  │ Quote        │  │ Title        │
│ Features[]   │  │ FullContent  │  │ Rating       │  │ Bio          │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│ VideoDemo    │  │IndustrySoln  │  │ContactMessage    │  │ ChatRequest  │
│──────────────│  │──────────────│  │──────────────────│  │──────────────│
│ VideoUrl     │  │ Slug(UNIQUE) │  │ Email            │  │ RequestType  │
│ Category     │  │ Challenges[] │  │ IsRead           │  │ IsResolved   │
│ Duration     │  │ Solutions[]  │  │ IsArchived       │  │ Priority     │
└──────────────┘  └──────────────┘  └──────────────────┘  └──────────────┘

┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│NewsletterSubscr. │  │  AuditLog    │  │ApiRequestLog │
│──────────────────│  │──────────────│  │──────────────│
│ Email (UNIQUE)   │  │ Action       │  │ Method       │
│ Token (UNIQUE)   │  │ EntityType   │  │ Path         │
│ IsActive         │  │ Details      │  │ StatusCode   │
└──────────────────┘  │ 90-day purge │  │ 30-day purge │
                      └──────────────┘  └──────────────┘
```

### Foreign Key Relationships

| Parent | Child | FK Column | Delete Behavior |
|--------|-------|-----------|-----------------|
| BlogCategory | BlogPost | `CategoryId` | **Restrict** (can't delete category with posts) |
| JobPosting | JobApplication | `JobPostingId` | **Cascade** (deleting job deletes all applications) |
| AspNetUsers | ChatMessage | `CustomerId` | No constraint (nullable, informal FK) |

---

## Schema Reference

### BaseEntity (Abstract)

All custom entities inherit these columns:

| Column | Type | Constraints |
|--------|------|-------------|
| `Id` | int | PK, auto-increment |
| `CreatedAt` | DateTime | UTC, auto-set on insert |
| `UpdatedAt` | DateTime | UTC, auto-set on insert/update |

---

### BlogCategory

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Name` | string | 50 | Required |
| `Slug` | string | 50 | Required, UNIQUE |
| `Description` | string | 500 | Nullable |

### BlogPost

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Title` | string | 200 | Required |
| `Slug` | string | 200 | Required, UNIQUE |
| `Summary` | string | 500 | Required |
| `Content` | string | — | Required (HTML) |
| `FeaturedImageUrl` | string | 500 | Nullable |
| `CategoryId` | int | — | FK → BlogCategory |
| `AuthorName` | string | 100 | Required |
| `Tags` | string | 500 | Nullable (comma-separated) |
| `IsPublished` | bool | — | Default: false |
| `PublishedAt` | DateTime? | — | Nullable |
| `ViewCount` | int | — | Default: 0 |
| `MetaTitle` | string | 200 | Nullable |
| `MetaDescription` | string | 500 | Nullable |

### Service

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Title` | string | 100 | Required |
| `ShortDescription` | string | 500 | Required |
| `FullDescription` | string | — | Required |
| `IconSvg` | string | — | Required (SVG markup) |
| `Slug` | string | 100 | Required, UNIQUE |
| `Category` | string | 50 | Required |
| `Features` | string | — | Required (JSON array), Default: `"[]"` |
| `SortOrder` | int | — | Required |
| `IsActive` | bool | — | Default: true |
| `IsFeatured` | bool | — | Default: false |

### CaseStudy

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Title` | string | 200 | Required |
| `Description` | string | — | Required |
| `FullContent` | string | — | Required (HTML) |
| `Tag` | string | 50 | Required |
| `GradientFrom` | string | 20 | Required (hex color) |
| `GradientTo` | string | 20 | Required (hex color) |
| `IconSvg` | string | — | Required |
| `Slug` | string | 200 | Required, UNIQUE |
| `IsActive` | bool | — | Default: true |
| `SortOrder` | int | — | Required |

### Testimonial

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `AuthorName` | string | 100 | Required |
| `AuthorTitle` | string | 100 | Required |
| `Company` | string | 100 | Required |
| `Quote` | string | — | Required |
| `Initials` | string | 5 | Required |
| `Rating` | int | — | Default: 5 (1-5) |
| `IsActive` | bool | — | Default: true |
| `SortOrder` | int | — | Required |

### TeamMember

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Name` | string | 100 | Required |
| `Title` | string | 100 | Required |
| `Bio` | string | — | Required |
| `ImageUrl` | string | 500 | Nullable |
| `SortOrder` | int | — | Required |
| `IsActive` | bool | — | Default: true |

### ContactMessage

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Name` | string | 100 | Required |
| `Email` | string | 200 | Required |
| `Phone` | string | 30 | Nullable |
| `Company` | string | 100 | Nullable |
| `Subject` | string | 200 | Required |
| `Message` | string | — | Required |
| `ServiceInterest` | string | 100 | Nullable |
| `IsRead` | bool | — | Default: false |
| `IsArchived` | bool | — | Default: false |
| `RepliedAt` | DateTime? | — | Nullable |

### NewsletterSubscriber

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Email` | string | 200 | Required, UNIQUE |
| `Name` | string | 100 | Nullable |
| `IsActive` | bool | — | Default: true |
| `Token` | string | 100 | Required, UNIQUE |
| `SubscribedAt` | DateTime | — | Default: DateTime.UtcNow |
| `UnsubscribedAt` | DateTime? | — | Nullable |

### VideoDemo

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Title` | string | 200 | Required |
| `Description` | string | — | Required |
| `VideoUrl` | string | 500 | Required |
| `ThumbnailUrl` | string | 500 | Nullable |
| `Duration` | string | 20 | Nullable |
| `Category` | string | 50 | Required |
| `IsActive` | bool | — | Default: true |
| `SortOrder` | int | — | Required |

### IndustrySolution

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Title` | string | 100 | Required |
| `ShortDescription` | string | 300 | Required |
| `FullDescription` | string | — | Required |
| `IconSvg` | string | — | Required |
| `Slug` | string | 100 | Required, UNIQUE |
| `Challenges` | string | — | JSON array, Default: `"[]"` |
| `Solutions` | string | — | JSON array, Default: `"[]"` |
| `SortOrder` | int | — | Required |
| `IsActive` | bool | — | Default: true |

### SiteSettings (singleton — does NOT inherit BaseEntity)

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Id` | int | — | PK |
| `CompanyName` | string | 100 | Required |
| `Tagline` | string | 200 | Required |
| `Description` | string | — | Required |
| `Phone` | string | 30 | Required |
| `Email` | string | 200 | Required |
| `Address` | string | — | Required |
| `FacebookUrl` | string | 500 | Nullable |
| `TwitterUrl` | string | 500 | Nullable |
| `LinkedInUrl` | string | 500 | Nullable |
| `GoogleMapsEmbed` | string | — | Nullable |
| `SmtpHost` | string | 200 | Nullable |
| `SmtpPort` | int | — | Default: 587 |
| `SmtpUsername` | string | 200 | Nullable |
| `SmtpPassword` | string | 200 | Nullable |
| `NewsletterEnabled` | bool | — | Default: false |

### ChatRequest

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Name` | string | 100 | Required |
| `Email` | string | 200 | Required, [EmailAddress] |
| `Phone` | string | 30 | Nullable |
| `Company` | string | 100 | Nullable |
| `RequestType` | string | 100 | Required |
| `Message` | string | — | Required |
| `ServiceInterest` | string | 100 | Nullable |
| `Priority` | string | 50 | Default: "Normal" |
| `IsResolved` | bool | — | Default: false |
| `AdminNotes` | string | 500 | Nullable |
| `ResolvedAt` | DateTime? | — | Nullable |
| `AssignedTo` | string | 100 | Nullable |

### ChatMessage

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `SessionId` | string | 100 | Required, Indexed |
| `SenderName` | string | 100 | Required |
| `SenderEmail` | string | 200 | Nullable |
| `Content` | string | — | Required |
| `IsFromAdmin` | bool | — | Required |
| `IsRead` | bool | — | Default: false |
| `CustomerId` | string | 450 | Nullable, Indexed |

### JobPosting

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Title` | string | 200 | Required |
| `Slug` | string | 200 | Required, UNIQUE |
| `Department` | string | 100 | Required |
| `Location` | string | 100 | Required |
| `EmploymentType` | string | 50 | Default: "Full-Time" |
| `SalaryRange` | string | 100 | Nullable |
| `Description` | string | — | Required (HTML) |
| `Requirements` | string | — | Nullable (HTML) |
| `NiceToHave` | string | — | Nullable (HTML) |
| `Summary` | string | 500 | Nullable |
| `IsActive` | bool | — | Default: true |
| `SortOrder` | int | — | Required |
| `ApplicationCount` | int | — | Default: 0 |

### JobApplication

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `JobPostingId` | int | — | FK → JobPosting (CASCADE) |
| `Name` | string | 100 | Required |
| `Email` | string | 200 | Required, [EmailAddress] |
| `Phone` | string | 30 | Nullable |
| `LinkedInUrl` | string | 200 | Nullable |
| `PortfolioUrl` | string | 200 | Nullable |
| `CoverLetter` | string | — | Nullable |
| `AdminNotes` | string | 500 | Nullable |
| `Status` | string | 50 | Default: "New" |

### AuditLog

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Action` | string | 100 | Required |
| `EntityType` | string | 100 | Required |
| `EntityId` | int? | — | Nullable |
| `UserId` | string | 450 | Nullable |
| `UserEmail` | string | 256 | Nullable |
| `Details` | string | — | Nullable (JSON) |
| `IpAddress` | string | 45 | Nullable |
| `CorrelationId` | string | 36 | Nullable |

### ApiRequestLog

| Column | Type | Max Length | Constraints |
|--------|------|-----------|-------------|
| `Method` | string | 10 | Required |
| `Path` | string | 2048 | Required |
| `StatusCode` | int | — | Required |
| `DurationMs` | long | — | Required |
| `ClientIp` | string | 45 | Nullable |
| `UserAgent` | string | 512 | Nullable |
| `UserId` | string | 450 | Nullable |
| `CorrelationId` | string | 36 | Nullable |
| `QueryString` | string | 2048 | Nullable |

---

## Indexes

### Unique Indexes

| Table | Column | Index Name |
|-------|--------|-----------|
| Service | Slug | `IX_Service_Slug` |
| BlogCategory | Slug | `IX_BlogCategory_Slug` |
| BlogPost | Slug | `IX_BlogPost_Slug` |
| CaseStudy | Slug | `IX_CaseStudy_Slug` |
| IndustrySolution | Slug | `IX_IndustrySolution_Slug` |
| JobPosting | Slug | `IX_JobPostings_Slug` |
| NewsletterSubscriber | Email | `IX_NewsletterSubscriber_Email` |
| NewsletterSubscriber | Token | `IX_NewsletterSubscriber_Token` |

### Performance Indexes

| Table | Column | Index Name | Purpose |
|-------|--------|-----------|---------|
| AuditLog | CreatedAt | `IX_AuditLog_CreatedAt` | Time-range queries, purge |
| AuditLog | Action | `IX_AuditLog_Action` | Filter by action type |
| AuditLog | EntityType | `IX_AuditLog_EntityType` | Filter by entity |
| ApiRequestLog | CreatedAt | `IX_ApiRequestLog_CreatedAt` | Time-range queries, purge |
| ApiRequestLog | Path | `IX_ApiRequestLog_Path` | Route analysis |
| ApiRequestLog | StatusCode | `IX_ApiRequestLog_StatusCode` | Error filtering |
| ChatMessage | SessionId | `IX_ChatMessages_SessionId` | Conversation lookup |
| ChatMessage | CreatedAt | `IX_ChatMessages_CreatedAt` | Time-range queries |
| ChatMessage | CustomerId | `IX_ChatMessages_CustomerId` | User session lookup |
| JobApplication | JobPostingId | `IX_JobApplications_JobPostingId` | FK lookup |
| JobApplication | Status | `IX_JobApplications_Status` | Workflow filtering |
| JobPosting | IsActive | `IX_JobPostings_IsActive` | Public listing filter |
| JobPosting | Department | `IX_JobPostings_Department` | Department filtering |

---

## Migration History

| # | Migration | Date | Changes |
|---|-----------|------|---------|
| 1 | `20260225060615_InitialCreate` | 2026-02-25 | All core entities: Service, BlogCategory, BlogPost, CaseStudy, Testimonial, TeamMember, ContactMessage, NewsletterSubscriber, VideoDemo, IndustrySolution, SiteSettings, ChatRequest + Identity tables |
| 2 | `20260225064538_AddAuditAndApiTracking` | 2026-02-25 | AuditLog, ApiRequestLog tables with indexes |
| 3 | `20260225150011_AddBlogCategoryDescription` | 2026-02-25 | Added `Description` column (nullable, max 500) to BlogCategory |
| 4 | `20260303162754_AddChatMessages` | 2026-03-03 | ChatMessage table + 3 indexes (SessionId, CreatedAt, CustomerId) |
| 5 | `20260303171535_AddJobPostings` | 2026-03-03 | JobPosting + JobApplication tables with FK, 5 indexes |

### Creating New Migrations

```bash
cd SLPSystems/SLPSystems.Web
dotnet ef migrations add YourMigrationName
dotnet ef database update
```

> **Rule**: Never modify a deployed migration. Always create a new one.

---

## Data Seeding

On first startup (`SeedData.InitializeAsync`):

| What | Details |
|------|---------|
| **Roles** | Admin, Editor, HR, Sales, Customer |
| **Admin User** | `admin@slpsystems.ca` / `Admin@123456` with Admin role |
| **SiteSettings** | Company info, contact details, default SMTP config |
| **Blog Categories** | 8 categories (Technology, AI, Cloud, etc.) |
| **Blog Posts** | 15+ sample articles across categories |
| **Services** | 6 IT services (AI/ML, Cloud, Data Engineering, etc.) |
| **Testimonials** | 5 sample client testimonials |
| **Case Studies** | 4 portfolio case studies |
| **Industry Solutions** | 6 industry verticals |
| **Team Members** | 5 sample team profiles |
| **Video Demos** | 4 demo videos |
| **Job Postings** | 4 Data Engineering / AI/ML positions |

All seed data uses slug-based deduplication (won't re-insert if slug already exists).

---

## Data Retention

Managed by `DataCleanupService` (background service on startup):

| Table | Retention | Purge Condition |
|-------|-----------|-----------------|
| AuditLog | 90 days | `CreatedAt < DateTime.UtcNow.AddDays(-90)` |
| ApiRequestLog | 30 days | `CreatedAt < DateTime.UtcNow.AddDays(-30)` |

---

## Query Patterns

### Common Query Patterns

```sql
-- Public blog listing (paginated)
SELECT * FROM BlogPosts
WHERE IsPublished = 1
ORDER BY PublishedAt DESC
LIMIT @pageSize OFFSET @offset;

-- Active job listings
SELECT * FROM JobPostings
WHERE IsActive = 1
ORDER BY SortOrder ASC;

-- Chat session messages
SELECT * FROM ChatMessages
WHERE SessionId = @sessionId
ORDER BY CreatedAt ASC;

-- Unread admin messages
SELECT COUNT(*) FROM ChatMessages
WHERE IsFromAdmin = 0 AND IsRead = 0;

-- Active sessions (last 24h)
SELECT DISTINCT SessionId, SenderName, SenderEmail,
       COUNT(*) as MessageCount
FROM ChatMessages
WHERE CreatedAt > @cutoff
GROUP BY SessionId;
```

---

## PostgreSQL Migration Guide

When you need to scale beyond SQLite:

### Step 1: Install PostgreSQL Package

```bash
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
```

### Step 2: Update Connection String

```json
// appsettings.json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=slpsystems;Username=postgres;Password=your_password"
  }
}
```

### Step 3: Update DbContext Registration

```csharp
// Program.cs — change from:
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(connectionString));

// to:
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));
```

### Step 4: Regenerate Migrations

```bash
rm -rf Migrations/
dotnet ef migrations add InitialPostgres
dotnet ef database update
```

### Step 5: Remove SQLite-Specific Config

Remove `HasAnnotation("Sqlite:WalMode", true)` from `OnModelCreating`.

### Step 6: Data Migration

```bash
# Export from SQLite
sqlite3 slpsystems.db .dump > dump.sql

# Import to PostgreSQL (may need syntax adjustments)
psql -d slpsystems -f dump.sql
```

> **Note**: All EF Core queries, indexes, and relationships will work without changes. Only the provider and connection string need to change.

---

*Last updated: 2026-03-05*
