# API Reference — SLP Systems Portal

> **Base URL**: `http://localhost:5062` (development) | `https://yourdomain.com` (production)
> **Auth**: Cookie-based sessions (ASP.NET Identity)
> **Docs**: Swagger UI at `/swagger` (development only)

---

## Table of Contents

- [Authentication](#authentication)
- [Response Formats](#response-formats)
- [Rate Limiting](#rate-limiting)
- [Endpoints by Domain](#endpoints-by-domain)
- [SignalR Hub](#signalr-live-chat-hub)

---

## Authentication

All admin endpoints require cookie authentication. Login first to get a session cookie.

```bash
# Login (sets auth cookie)
curl -X POST http://localhost:5062/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@slpsystems.ca","password":"Admin@123456"}'

# Use cookie for authenticated requests
curl http://localhost:5062/api/admin/dashboard \
  -b cookies.txt
```

### Roles

| Role | Scope |
|------|-------|
| **Admin** | Full access to all endpoints |
| **Editor** | Blog management (create, edit, delete posts) |
| **HR** | Team and job posting management |
| **Sales** | Contact messages, newsletter, chat requests, live chat |
| **Customer** | Customer portal, blog reading, live chat |

---

## Response Formats

### Success Response

```json
{
  "id": 1,
  "title": "Senior Data Engineer",
  "slug": "senior-data-engineer",
  "createdAt": "2026-03-03T16:27:54Z"
}
```

### Error Response

```json
{
  "detail": "Job posting not found.",
  "error_code": "NOT_FOUND"
}
```

### Paginated Response

```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "pageSize": 10
}
```

---

## Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Default | 100 requests | 60 seconds |
| Per IP | Yes | Sliding window |
| Response | 429 Too Many Requests | `Retry-After` header |

Configurable via `appsettings.json`:
```json
{ "RateLimit": { "MaxRequests": 100, "WindowSeconds": 60 } }
```

---

## Endpoints by Domain

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | System health check with DB status |

---

### Home / Site Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/home` | — | Homepage data (featured services, testimonials, stats) |
| GET | `/api/home/settings` | — | Site settings (company info, social URLs) |
| PUT | `/api/home/settings` | Admin | Update site settings |

---

### Admin Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login. Body: `{email, password}`. Returns user + roles. Sets cookie. |
| POST | `/api/auth/logout` | — | Logout. Clears cookie. |
| GET | `/api/auth/me` | Yes | Current authenticated user info |

---

### Customer Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/customer/auth/register` | — | Register. Body: `{name, email, password}`. Creates Customer role user. |
| POST | `/api/customer/auth/login` | — | Login (Customer role only). Body: `{email, password}`. |
| POST | `/api/customer/auth/logout` | — | Logout customer. |
| GET | `/api/customer/auth/me` | Customer | Current customer info with DisplayName. |

---

### Blog

#### Public

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/blog` | — | Paginated published posts. Params: `page`, `pageSize`, `categoryId`, `tag`, `search` |
| GET | `/api/blog/recent` | — | Recent posts. Param: `count` (default 5) |
| GET | `/api/blog/categories` | — | All categories |
| GET | `/api/blog/{slug}` | — | Single post by slug |

#### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/blog` | Admin, Editor | Create post. Body: BlogPost model. Returns 201. |
| PUT | `/api/blog/{id}` | Admin, Editor | Update post |
| DELETE | `/api/blog/{id}` | Admin | Delete post. Returns 204. |
| POST | `/api/blog/categories` | Admin | Create category. Body: `{name, slug, description}`. 409 on slug conflict. |
| PUT | `/api/blog/categories/{id}` | Admin | Update category. 409 on slug conflict. |
| DELETE | `/api/blog/categories/{id}` | Admin | Delete category. 400 if has posts. |

---

### Services

#### Public

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/services` | — | All active services (ordered by SortOrder) |
| GET | `/api/services/featured` | — | Featured services (IsActive && IsFeatured) |
| GET | `/api/services/category/{category}` | — | Services by category |
| GET | `/api/services/{slug}` | — | Single service by slug |

#### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/services` | Admin | Create service. Returns 201. |
| PUT | `/api/services/{id}` | Admin | Update service |
| DELETE | `/api/services/{id}` | Admin | Delete service. Returns 204. |

---

### Industries

#### Public

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/industries` | — | All active industry solutions |
| GET | `/api/industries/{slug}` | — | Single industry by slug |

#### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/industries` | Admin | Create industry solution. Returns 201. |
| PUT | `/api/industries/{id}` | Admin | Update industry solution |
| DELETE | `/api/industries/{id}` | Admin | Delete industry solution. Returns 204. |

---

### Case Studies

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/casestudies` | — | All active case studies |
| GET | `/api/casestudies/{slug}` | — | Single case study by slug |
| POST | `/api/casestudies` | Admin | Create. Returns 201. |
| PUT | `/api/casestudies/{id}` | Admin | Update |
| DELETE | `/api/casestudies/{id}` | Admin | Delete. Returns 204. |

---

### Team

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/team` | — | All active team members |
| GET | `/api/team/{id}` | — | Single member by ID |
| POST | `/api/team` | Admin, HR | Create. Returns 201. |
| PUT | `/api/team/{id}` | Admin, HR | Update |
| DELETE | `/api/team/{id}` | Admin, HR | Delete. Returns 204. |

---

### Testimonials

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/testimonials` | — | All active testimonials |
| GET | `/api/testimonials/{id}` | — | Single testimonial by ID |
| POST | `/api/testimonials` | Admin | Create. Returns 201. |
| PUT | `/api/testimonials/{id}` | Admin | Update |
| DELETE | `/api/testimonials/{id}` | Admin | Delete. Returns 204. |

---

### Videos

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/videos` | — | All active videos |
| GET | `/api/videos/category/{category}` | — | Videos by category |
| GET | `/api/videos/{id}` | — | Single video by ID |
| POST | `/api/videos` | Admin | Create. Returns 201. |
| PUT | `/api/videos/{id}` | Admin | Update |
| DELETE | `/api/videos/{id}` | Admin | Delete. Returns 204. |

---

### Contact

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/contact` | — | Submit contact form. Body: `{name, email, subject, message, phone?, company?, serviceInterest?}`. Returns 201. |
| GET | `/api/contact` | Admin, Sales | All messages |
| GET | `/api/contact/{id}` | Admin, Sales | Single message |
| PUT | `/api/contact/{id}/read` | Admin, Sales | Mark as read |
| PUT | `/api/contact/{id}/archive` | Admin, Sales | Archive message |
| GET | `/api/contact/unread-count` | Admin, Sales | Unread count. Returns `{count}`. |

---

### Newsletter

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/newsletter/subscribe` | — | Subscribe. Body: `{email, name?}`. 400 on duplicate. |
| GET | `/api/newsletter/unsubscribe/{token}` | — | Unsubscribe via token |
| GET | `/api/newsletter/confirm/{token}` | — | Confirm subscription |
| GET | `/api/newsletter/subscribers` | Admin, Sales | All active subscribers |
| GET | `/api/newsletter/count` | Admin, Sales | Total count. Returns `{count}`. |

---

### Chat Requests

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat-requests` | — | Submit chat request. Body: `{name, email, requestType, message, ...}`. |
| GET | `/api/chat-requests` | Admin, Sales | All requests (newest first) |
| GET | `/api/chat-requests/unresolved` | Admin, Sales | Unresolved requests only |
| GET | `/api/chat-requests/unresolved-count` | Admin, Sales | Unresolved count. Returns `{count}`. |
| GET | `/api/chat-requests/{id}` | Admin, Sales | Single request |
| PUT | `/api/chat-requests/{id}/resolve` | Admin, Sales | Resolve. Body: `{adminNotes?}`. |
| PUT | `/api/chat-requests/{id}/assign` | Admin | Assign. Body: `{assignedTo}`. |
| DELETE | `/api/chat-requests/{id}` | Admin | Delete. Returns 204. |

---

### Jobs / Careers

#### Public

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/jobs` | — | Active job listings. Param: `department` (optional filter). |
| GET | `/api/jobs/departments` | — | List of departments with active jobs |
| GET | `/api/jobs/slug/{slug}` | — | Single job by slug |
| POST | `/api/jobs/{id}/apply` | — | Submit application. Body: `{name, email, phone?, linkedInUrl?, portfolioUrl?, coverLetter?}`. Increments ApplicationCount. |

#### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/jobs/admin/all` | Admin, HR | All job postings (including inactive) |
| GET | `/api/jobs/admin/{id}` | Admin, HR | Single job with full details |
| POST | `/api/jobs` | Admin, HR | Create job posting. Auto-generates slug. |
| PUT | `/api/jobs/{id}` | Admin, HR | Update job posting |
| DELETE | `/api/jobs/{id}` | Admin, HR | Delete job + all applications (cascade). |
| GET | `/api/jobs/admin/applications` | Admin, HR | All applications. Params: `jobId`, `status` (optional filters). |
| PUT | `/api/jobs/admin/applications/{id}/status` | Admin, HR | Update status. Body: `{status, adminNotes?}`. Values: New, Reviewed, Shortlisted, Rejected. |

---

### Live Chat (REST)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/live-chat/history/{sessionId}` | — | Message history for session |
| GET | `/api/live-chat/sessions` | Admin, Sales | Active sessions. Param: `hours` (default 24). Returns sessionId, customerName, customerEmail, messageCount, unreadCount, lastMessage. |
| GET | `/api/live-chat/unread-count` | Admin, Sales | Total unread messages. Returns `{count}`. |
| GET | `/api/live-chat/customer-sessions` | Customer | Customer's own sessions |

---

### Admin Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/dashboard` | Admin | Dashboard stats: totalServices, totalBlogPosts, totalCaseStudies, unreadMessages, subscriberCount, recentMessages, recentPosts |

---

### Admin Monitoring

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/monitoring/api-requests` | Admin | Paginated API request logs. Params: `page`, `pageSize`, `method`, `statusCode`, `path`. |
| GET | `/api/admin/monitoring/api-requests/stats` | Admin | API performance metrics (last 24h): totalRequests, avgDurationMs, errorCount, errorRate, topEndpoints, statusDistribution |
| GET | `/api/admin/monitoring/audit-logs` | Admin | Paginated audit trail. Params: `page`, `pageSize`, `action`, `entityType`, `userId`. |
| GET | `/api/admin/monitoring/system-health` | Admin | System health: DB size, record counts, runtime (memory, uptime, environment) |
| GET | `/api/admin/monitoring/logs/recent` | Admin | Application log file. Params: `lines` (default 100), `level`. |

---

### Users Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/users` | Admin | All users with roles |
| POST | `/api/admin/users` | Admin | Create user. Body: `{email, password, role}`. Valid roles: Admin, Editor, HR, Sales. |
| PUT | `/api/admin/users/{id}/roles` | Admin | Update roles. Body: `{roles: string[]}`. |
| DELETE | `/api/admin/users/{id}` | Admin | Delete user. Cannot delete self. Returns 204. |

---

## SignalR Live Chat Hub

**Endpoint**: `ws://localhost:5062/hubs/chat`

### Client → Server Methods

| Method | Parameters | Description |
|--------|-----------|-------------|
| `JoinSession` | `sessionId`, `name`, `email` | Customer joins chat. Adds to `session-{id}` group. Notifies admins via `CustomerConnected`. |
| `SendMessage` | `sessionId`, `name`, `email`, `content`, `customerId?` | Customer sends message. Persists to DB. Broadcasts to session + admins. |
| `AdminReply` | `sessionId`, `adminName`, `content` | Admin replies. Persists to DB. Broadcasts to session + admins. |
| `JoinAdminRoom` | — | Admin joins `admins` group to receive all notifications. |
| `MarkRead` | `sessionId` | Mark all messages in session as read. |

### Server → Client Events

| Event | Payload | When |
|-------|---------|------|
| `ReceiveMessage` | `{id, sessionId, senderName, senderEmail?, content, isFromAdmin, createdAt}` | New message sent or received |
| `CustomerConnected` | `{sessionId, name, email, connectedAt}` | Customer joins a chat session |

### Connection Example (JavaScript)

```typescript
import { HubConnectionBuilder } from '@microsoft/signalr';

const connection = new HubConnectionBuilder()
  .withUrl('http://localhost:5062/hubs/chat')
  .withAutomaticReconnect()
  .build();

await connection.start();

// Customer: join session
await connection.invoke('JoinSession', sessionId, 'Jane', 'jane@example.com');

// Customer: send message
await connection.invoke('SendMessage', sessionId, 'Jane', 'jane@example.com', 'Hello!');

// Listen for messages
connection.on('ReceiveMessage', (msg) => {
  console.log(`${msg.senderName}: ${msg.content}`);
});

// Admin: join admin room
await connection.invoke('JoinAdminRoom');

// Admin: reply to customer
await connection.invoke('AdminReply', sessionId, 'Support Team', 'How can we help?');
```

---

### Endpoint Count Summary

| Category | Public | Authenticated | Total |
|----------|--------|---------------|-------|
| Health | 1 | — | 1 |
| Home/Settings | 2 | 1 | 3 |
| Auth (Admin) | 2 | 1 | 3 |
| Auth (Customer) | 2 | 1 | 3 |
| Blog | 4 | 6 | 10 |
| Services | 4 | 3 | 7 |
| Industries | 2 | 3 | 5 |
| Case Studies | 2 | 3 | 5 |
| Team | 2 | 3 | 5 |
| Testimonials | 2 | 3 | 5 |
| Videos | 3 | 3 | 6 |
| Contact | 1 | 4 | 5 |
| Newsletter | 3 | 2 | 5 |
| Chat Requests | 1 | 7 | 8 |
| Jobs/Careers | 4 | 7 | 11 |
| Live Chat | 1 | 3 | 4 |
| Dashboard | — | 1 | 1 |
| Monitoring | — | 5 | 5 |
| Users | — | 4 | 4 |
| **Total** | **36** | **60** | **96** |
| SignalR Hub | — | 5 methods + 2 events | 7 |

---

*Last updated: 2026-03-05*
