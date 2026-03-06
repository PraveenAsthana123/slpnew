# Flowcharts — SLP Systems Portal

**Version:** 1.0  
**Date:** 2026-03-03  
**Format:** Mermaid flowchart syntax (renders on GitHub)

---

## Table of Contents

1. [User Registration and Login Flow (Customer)](#1-user-registration-and-login-flow-customer)
2. [Admin Login and Content Management Workflow](#2-admin-login-and-content-management-workflow)
3. [Live Chat Session Lifecycle](#3-live-chat-session-lifecycle)
4. [Job Application Submission Workflow](#4-job-application-submission-workflow)
5. [Blog Post Creation and Publish Workflow](#5-blog-post-creation-and-publish-workflow)
6. [Contact Form Submission Flow](#6-contact-form-submission-flow)
7. [Deployment Pipeline Flow](#7-deployment-pipeline-flow)

---

## 1. User Registration and Login Flow (Customer)

```mermaid
flowchart TD
    A([Visitor arrives at site]) --> B{Has account?}

    B -- No --> C[Click Register on /customer/register]
    B -- Yes --> L[Click Login on /customer/login]

    C --> D[Fill form: Name, Email, Password]
    D --> E{Client-side validation}
    E -- Invalid --> F[Show inline field errors]
    F --> D
    E -- Valid --> G[POST /api/customer/auth/register]

    G --> H{Backend checks}
    H -- Email already exists --> I[409 Conflict: EMAIL_TAKEN]
    I --> J[Show error: 'Email already registered']
    J --> D

    H -- Password too weak --> K[400 Bad Request: REGISTRATION_FAILED]
    K --> M[Show password policy errors]
    M --> D

    H -- Success --> N[Create IdentityUser]
    N --> O[Add to 'Customer' role]
    O --> P[Add 'DisplayName' claim]
    P --> Q[SignInAsync - set auth cookie]
    Q --> R[200 OK: user object returned]
    R --> S[Frontend stores user state]
    S --> T[Redirect to /customer/dashboard]

    L --> U[Fill form: Email, Password]
    U --> V{Client-side validation}
    V -- Invalid --> W[Show field errors]
    W --> U
    V -- Valid --> X[POST /api/customer/auth/login]

    X --> Y{Backend checks}
    Y -- User not found --> Z[401: INVALID_CREDENTIALS]
    Z --> AA[Show generic error - no user enumeration]
    AA --> U

    Y -- Not in Customer role --> AB[401: INVALID_CREDENTIALS]
    AB --> AA

    Y -- Account locked --> AC[401: ACCOUNT_LOCKED]
    AC --> AD[Show lockout message with retry time]

    Y -- Wrong password --> AE[401: INVALID_CREDENTIALS]
    AE --> AA

    Y -- Success --> AF[PasswordSignInAsync - set cookie]
    AF --> AG[200 OK: user + DisplayName claim]
    AG --> AH[Frontend stores user state]
    AH --> AI[Redirect to /customer/dashboard]

    T --> AJ([Customer Portal])
    AI --> AJ
```

---

## 2. Admin Login and Content Management Workflow

```mermaid
flowchart TD
    A([Admin navigates to /auth/login]) --> B[Enter Email and Password]
    B --> C[POST /api/auth/login]

    C --> D{Validate credentials}
    D -- Invalid --> E[401: INVALID_CREDENTIALS]
    E --> F[Show error toast]
    F --> B

    D -- Locked out --> G[401: ACCOUNT_LOCKED]
    G --> H[Show lockout message]

    D -- Success --> I[Cookie set HttpOnly SameSite=None Secure]
    I --> J[Return user roles array]
    J --> K[Frontend stores auth state]
    K --> L[Redirect to /admin/dashboard]

    L --> M[Admin Dashboard loads]
    M --> N[GET /api/admin/dashboard]
    N --> O[Display: stats, recent messages, recent posts]

    O --> P{Choose action}

    P -- Blog --> Q[Navigate to /admin/blog]
    Q --> QA[GET /api/blog - all posts]
    QA --> QB{Action?}
    QB -- Create new --> R[Navigate to /admin/blog/new]
    R --> S[Fill form + TipTap editor]
    S --> T[POST /api/blog]
    T --> U{Valid?}
    U -- No --> V[Show validation errors]
    V --> S
    U -- Yes --> W[Redirect to /admin/blog]
    QB -- Edit existing --> X[Navigate to /admin/blog/edit/id]
    X --> XA[Load existing post data]
    XA --> XB[Modify in TipTap editor]
    XB --> XC[PUT /api/blog/id]
    XC --> W
    QB -- Delete --> XD[ConfirmModal opens]
    XD -- Confirm --> XE[DELETE /api/blog/id]
    XE --> W
    XD -- Cancel --> QB

    P -- Jobs --> Y[Navigate to /admin/jobs]
    Y --> YA{Action?}
    YA -- Create job --> YB[Fill job posting form + RichTextEditor]
    YB --> YC[POST /api/jobs]
    YC --> YD[Redirect to /admin/jobs]
    YA -- Review applications --> YE[View application list]
    YE --> YF[Select application]
    YF --> YG{Update status}
    YG -- Shortlist --> YH[PUT /api/jobs/admin/applications/id/status - Shortlisted]
    YG -- Reject --> YI[PUT /api/jobs/admin/applications/id/status - Rejected]
    YH --> YD
    YI --> YD

    P -- Messages --> Z[Navigate to /admin/messages]
    Z --> ZA[GET /api/contact - all messages]
    ZA --> ZB[Select message]
    ZB --> ZC{Action?}
    ZC -- Mark read --> ZD[PUT /api/contact/id/read]
    ZD --> ZA
    ZC -- Archive --> ZE[PUT /api/contact/id/archive]
    ZE --> ZA

    P -- Users --> AA[Navigate to /admin/users]
    AA --> AB[GET /api/admin/users]
    AB --> AC{Action?}
    AC -- Create user --> AD[Enter email, password, role]
    AD --> AE[POST /api/admin/users]
    AE --> AB
    AC -- Update roles --> AF[Select new roles]
    AF --> AG[PUT /api/admin/users/id/roles]
    AG --> AB
    AC -- Delete user --> AH[ConfirmModal]
    AH -- Confirm --> AI[DELETE /api/admin/users/id]
    AI --> AB

    P -- Live Chat --> AJ[Navigate to /admin/live-chat]
    AJ --> AK[hub.invoke - JoinAdminRoom]
    AK --> AL[GET /api/live-chat/sessions]
    AL --> AM[Select active session]
    AM --> AN[View message thread]
    AN --> AO[Type reply]
    AO --> AP[hub.invoke - AdminReply]
    AP --> AN

    P -- Logout --> AQ[POST /api/auth/logout]
    AQ --> AR[Cookie cleared]
    AR --> AS([Redirect to /auth/login])
```

---

## 3. Live Chat Session Lifecycle

```mermaid
flowchart TD
    A([Visitor on public page]) --> B[ChatWidget floating bubble visible]
    B --> C[Visitor clicks chat bubble]
    C --> D[LiveChatWidget panel opens]
    D --> E{Session in localStorage?}

    E -- No --> F[Generate sessionId via crypto.randomUUID]
    F --> G[Store sessionId in localStorage]
    G --> H[Prompt for Name and Email]
    H --> I[Visitor enters details]

    E -- Yes --> J[Restore sessionId from localStorage]
    J --> K[Load message history: GET /api/live-chat/history/sessionId]

    I --> L[SignalR connection initiated to /hubs/chat]
    K --> L

    L --> M{Connection successful?}
    M -- No --> N[Show retry button]
    N --> O[Retry after 2s 5s 10s]
    O --> L

    M -- Yes --> P[hub.invoke: JoinSession sessionId name email]
    P --> Q[Server adds ConnectionId to group 'session-sessionId']
    Q --> R[Server sends CustomerConnected to 'admins' group]
    R --> S[Admin panel shows new session indicator]

    S --> T[Visitor types message]
    T --> U[hub.invoke: SendMessage sessionId name email content]
    U --> V[Server creates ChatMessage IsFromAdmin=false]
    V --> W[Saved to DB]
    W --> X[Server sends ReceiveMessage to 'admins']
    X --> Y[Server sends ReceiveMessage to 'session-sessionId']
    Y --> Z[Visitor sees own message confirmed]

    X --> AA[Admin sees message in session list]
    AA --> AB{Admin responds?}

    AB -- Yes --> AC[Admin selects session in /admin/live-chat]
    AC --> AD[hub.invoke: MarkRead sessionId]
    AD --> AE[DB: IsRead=true for customer messages]
    AE --> AF[Admin types reply]
    AF --> AG[hub.invoke: AdminReply sessionId adminName content]
    AG --> AH[Server creates ChatMessage IsFromAdmin=true]
    AH --> AI[Saved to DB]
    AI --> AJ[Server sends ReceiveMessage to 'session-sessionId']
    AJ --> AK[Visitor receives admin reply in real-time]
    AI --> AL[Server echoes to 'admins' group]
    AL --> AM[All admin tabs see the reply]

    AB -- No, unattended --> AN[Session remains in active list for 24h]

    AK --> AO{Visitor continues or leaves?}
    AO -- Continues --> T
    AO -- Closes widget --> AP[Panel hidden - connection stays open in background]
    AO -- Closes tab --> AQ[SignalR OnDisconnectedAsync fires]
    AQ --> AR[Server logs disconnection]
    AR --> AS[Group membership auto-removed by SignalR]
    AS --> AT([Session messages retained in DB indefinitely])

    AP --> AU{Visitor reopens widget?}
    AU -- Yes --> AV[Restore from localStorage sessionId]
    AV --> K
    AU -- Session expired page refresh --> F
```

---

## 4. Job Application Submission Workflow

```mermaid
flowchart TD
    A([Visitor on /careers page]) --> B[GET /api/jobs - active listings]
    B --> C[Browse job listings by department filter]
    C --> D[Click on job title]
    D --> E[Navigate to /careers/job-slug]
    E --> F[GET /api/jobs/slug/job-slug]
    F --> G{Job found and active?}

    G -- No --> H[Show 404 page]
    G -- Yes --> I[Display full job description]
    I --> J[Requirements and NiceToHave sections]
    J --> K[Visitor clicks Apply Now]
    K --> L[Application form slides into view]

    L --> M[Fill required fields]
    M --> N[Name - required]
    M --> O[Email - required, validated format]
    M --> P[Phone - optional]
    M --> Q[LinkedIn URL - optional]
    M --> R[Portfolio URL - optional]
    M --> S[Cover Letter - optional rich text]

    S --> T[Click Submit Application]
    T --> U{Client-side validation}
    U -- Name empty --> V[Show: Name is required]
    U -- Email invalid --> W[Show: Valid email required]
    V --> M
    W --> M

    U -- Valid --> X[POST /api/jobs/id/apply]

    X --> Y{Backend validation}
    Y -- Job not found --> Z[404: NOT_FOUND]
    Z --> AA[Show: This position is no longer available]

    Y -- Job inactive --> AB[404: NOT_FOUND]
    AB --> AA

    Y -- ModelState invalid --> AC[400: VALIDATION_ERROR]
    AC --> AD[Display server-side errors]
    AD --> M

    Y -- Valid --> AE[application.Status = 'New']
    AE --> AF[DB: INSERT JobApplication]
    AF --> AG[DB: JobPosting.ApplicationCount++]
    AG --> AH[SaveChangesAsync]
    AH --> AI[200 OK: detail - Application submitted]

    AI --> AJ[Show success confirmation message]
    AJ --> AK[Form hidden, thank-you message displayed]

    AK --> AL([Admin review phase])
    AL --> AM[Admin navigates to /admin/jobs]
    AM --> AN[GET /api/jobs/admin/applications]
    AN --> AO[Filter by job or status]
    AO --> AP[Click on application row]
    AP --> AQ[View applicant details]

    AQ --> AR{Review decision}
    AR -- Mark reviewed --> AS[PUT /api/jobs/admin/applications/id/status - Reviewed]
    AR -- Shortlist --> AT[PUT /api/jobs/admin/applications/id/status - Shortlisted]
    AR -- Reject --> AU[PUT /api/jobs/admin/applications/id/status - Rejected]

    AS --> AV[DB: application.Status updated]
    AT --> AV
    AU --> AV
    AV --> AW[Add AdminNotes if needed]
    AW --> AX([Application status persisted])
```

---

## 5. Blog Post Creation and Publish Workflow

```mermaid
flowchart TD
    A([Admin on /admin/blog]) --> B[Click Create New Post]
    B --> C[Navigate to /admin/blog/new]
    C --> D[RichTextEditor TipTap initialises empty]

    D --> E[Fill post metadata]
    E --> F[Title - required max 200 chars]
    E --> G[Slug - auto-generated from title or manual override]
    E --> H[Summary - required max 500 chars]
    E --> I[Category - select from dropdown]
    E --> J[Author Name - required]
    E --> K[Tags - comma-separated optional]
    E --> L[Featured Image URL - optional]
    E --> M[Meta Title and Meta Description - optional SEO]
    E --> N[Content - rich text in TipTap editor]

    G --> GA{Slug empty?}
    GA -- Yes --> GB[Auto-generate: BlogService.GenerateSlug from title]
    GB --> G
    GA -- No --> GC[Use as-is]

    N --> O[Click Save as Draft]
    O --> P[IsPublished = false]
    P --> Q[POST /api/blog with auth cookie]

    Q --> R{Backend validates}
    R -- ModelState invalid --> S[400: VALIDATION_ERROR]
    S --> T[Show field errors in form]
    T --> E

    R -- Slug conflict --> U[409: CONFLICT - slug already exists]
    U --> V[Show: Slug already in use, modify it]
    V --> G

    R -- Valid --> W[GenerateSlug if slug empty]
    W --> X[DB: INSERT BlogPost IsPublished=false PublishedAt=null]
    X --> Y[201 Created: BlogPost returned]
    Y --> Z[Redirect to /admin/blog/edit/id]
    Z --> AA[Edit page loads with saved data]

    AA --> AB[Continue editing content]
    AB --> AC[Click Save Changes]
    AC --> AD[PUT /api/blog/id]
    AD --> AE[DB: UPDATE BlogPost UpdatedAt=now]
    AE --> AF[200 OK]
    AF --> AA

    AA --> AG{Ready to publish?}
    AG -- No --> AB
    AG -- Yes --> AH[Toggle IsPublished = true]
    AH --> AI[PUT /api/blog/id]

    AI --> AJ{IsPublished newly true?}
    AJ -- Yes --> AK[Set PublishedAt = UtcNow]
    AK --> AL[DB: UPDATE BlogPost IsPublished=true PublishedAt=now]
    AJ -- No change --> AL

    AL --> AM[200 OK: updated post]
    AM --> AN[Admin sees Published badge in post list]

    AN --> AO([Post now publicly visible])
    AO --> AP[Public GET /api/blog returns this post]
    AP --> AQ[GET /api/blog/slug shows full content]
    AQ --> AR[ViewCount incremented on each slug fetch]

    AN --> AS{Need to unpublish?}
    AS -- Yes --> AT[Toggle IsPublished = false]
    AT --> AU[PUT /api/blog/id]
    AU --> AV[DB: IsPublished=false PublishedAt unchanged]
    AV --> AW[Post hidden from public listing]
    AW --> AA

    AN --> AX{Delete post?}
    AX -- Yes --> AY[ConfirmModal opens]
    AY -- Confirm --> AZ[DELETE /api/blog/id]
    AZ --> BA[DB: DELETE BlogPost row]
    BA --> BB[204 No Content]
    BB --> BC([Redirect to /admin/blog])
    AY -- Cancel --> AN
```

---

## 6. Contact Form Submission Flow

```mermaid
flowchart TD
    A([Visitor on /contact page]) --> B[Page loads ContactForm component]
    B --> C[Fill contact form fields]

    C --> D[Name - required]
    C --> E[Email - required, valid format]
    C --> F[Phone - optional]
    C --> G[Company - optional]
    C --> H[Subject - required]
    C --> I[Message - required]
    C --> J[Service Interest - optional dropdown]

    J --> K[Click Send Message]
    K --> L{Client-side validation}

    L -- Name empty --> M[Highlight Name field: required]
    L -- Email invalid --> N[Highlight Email field: invalid format]
    L -- Subject empty --> O[Highlight Subject field: required]
    L -- Message empty --> P[Highlight Message field: required]

    M --> C
    N --> C
    O --> C
    P --> C

    L -- All valid --> Q[Show loading spinner on button]
    Q --> R[POST /api/contact]

    R --> S{Backend ModelState valid?}
    S -- No --> T[400: VALIDATION_ERROR]
    T --> U[Show error toast with field details]
    U --> C

    S -- Yes --> V[ContactService.SubmitMessageAsync]
    V --> W[DB: INSERT ContactMessage IsRead=false IsArchived=false]
    W --> X[SaveChangesAsync]

    X --> Y{Email service configured?}
    Y -- Yes --> Z[EmailService.SendContactNotificationAsync]
    Z --> ZA{SMTP call succeeds?}
    ZA -- Yes --> ZB[Admin notification email sent]
    ZA -- No, SMTP error --> ZC[Log warning - email failed but do not fail request]
    ZB --> ZD[201 Created: ContactMessage returned]
    ZC --> ZD

    Y -- No, SMTP not configured --> ZD

    ZD --> ZE[Frontend receives success response]
    ZE --> ZF[Hide form]
    ZF --> ZG[Show success message: 'Message sent! We will be in touch.']
    ZG --> ZH([Visitor sees confirmation])

    ZD --> ZI([Admin review phase])
    ZI --> ZJ[Admin navigates to /admin/messages]
    ZJ --> ZK[GET /api/contact - all messages]
    ZK --> ZL[Unread messages shown with badge indicator]
    ZL --> ZM[Admin clicks on message row]
    ZM --> ZN[GET /api/contact/id - message detail]

    ZN --> ZO{Admin action?}
    ZO -- Mark as read --> ZP[PUT /api/contact/id/read]
    ZP --> ZQ[DB: IsRead=true]
    ZQ --> ZR[Unread count badge decrements]
    ZR --> ZK

    ZO -- Archive --> ZS[PUT /api/contact/id/archive]
    ZS --> ZT[DB: IsArchived=true]
    ZT --> ZK

    ZO -- Reply externally --> ZU[Admin uses email client to respond]
    ZU --> ZV[Optional: manually set RepliedAt via future endpoint]
```

---

## 7. Deployment Pipeline Flow

```mermaid
flowchart TD
    A([Developer pushes commit]) --> B{Target branch?}

    B -- develop or main --> C[GitHub Actions CI workflow triggers]
    B -- feature branch or PR --> C

    C --> D[Job: frontend-lint-build]
    C --> E[Job: backend-build-test]
    C --> F[Job: security-scan - depends on D and E]

    D --> D1[actions/setup-node v4 Node 20]
    D1 --> D2[npm ci - install dependencies]
    D2 --> D3[npm run lint - ESLint]
    D3 --> D4{Lint passed?}
    D4 -- No --> D5[CI fails - block merge]
    D4 -- Yes --> D6[npx tsc --noEmit - type check]
    D6 --> D7{Types valid?}
    D7 -- No --> D5
    D7 -- Yes --> D8[npm run build]
    D8 --> D9{Build succeeded?}
    D9 -- No --> D5
    D9 -- Yes --> D10{Branch = main?}
    D10 -- Yes --> D11[Upload .next build artifact]
    D10 -- No --> D12[Frontend CI done]
    D11 --> D12

    E --> E1[actions/setup-dotnet v4 .NET 8]
    E1 --> E2[dotnet restore]
    E2 --> E3[dotnet build --configuration Release]
    E3 --> E4{Build succeeded?}
    E4 -- No --> E5[CI fails]
    E4 -- Yes --> E6[dotnet test]
    E6 --> E7[dotnet publish to ./publish]
    E7 --> E8{Branch = main?}
    E8 -- Yes --> E9[Upload dotnet publish artifact]
    E8 -- No --> E10[Backend CI done]
    E9 --> E10

    F --> F1[TruffleHog secret scan]
    F --> F2[Trivy filesystem scan HIGH CRITICAL]
    F1 --> F3[Security scan done - continue-on-error]
    F2 --> F3

    D12 --> G{All CI jobs passed?}
    E10 --> G
    F3 --> G

    G -- No --> H[PR blocked or branch build failed]
    G -- Yes, branch = main --> I[Deploy workflow triggers automatically]
    G -- Yes, other branch --> J([CI green - PR can be merged])

    I --> K[Job: build-push-images]
    K --> K1[docker/login-action - GHCR login with GITHUB_TOKEN]
    K1 --> K2[docker/setup-buildx-action]

    K2 --> K3[Build backend Docker image]
    K3 --> K4[docker/build-push-action context ./SLPSystems/SLPSystems.Web]
    K4 --> K5[Tag: sha-shortsha and latest]
    K5 --> K6[Push to ghcr.io/owner/slp-backend]

    K2 --> K7[Build frontend Docker image]
    K7 --> K8[docker/build-push-action with NEXT_PUBLIC_API_URL build-arg]
    K8 --> K9[Tag: sha-shortsha and latest]
    K9 --> K10[Push to ghcr.io/owner/slp-frontend]

    K6 --> L[Job: deploy - depends on build-push-images]
    K10 --> L

    L --> L1[appleboy/ssh-action connects to server]
    L1 --> L2[SSH: cd /opt/slp-portal]
    L2 --> L3[SSH: git pull origin main]
    L3 --> L4[SSH: docker login ghcr.io]
    L4 --> L5[SSH: docker compose pull - pull latest images]
    L5 --> L6[SSH: docker compose up -d --remove-orphans]

    L6 --> M{Docker health checks}
    M --> M1[backend: wget /api/health every 30s]
    M --> M2[frontend: wget / every 30s]

    M1 --> M3{Backend healthy?}
    M3 -- Yes after 3 retries --> M4[Backend container running]
    M3 -- No after 3 retries --> M5[Docker restarts container automatically]
    M5 --> M1

    M2 --> M6{Frontend healthy?}
    M6 -- Yes --> M7[Frontend container running]
    M6 -- No --> M8[Docker restarts frontend container]
    M8 --> M2

    M4 --> N[SSH: docker image prune -f]
    M7 --> N
    N --> O[SSH: echo Deployment complete at date]
    O --> P([Production site updated])

    L6 --> Q[Nginx reverse proxy routes traffic]
    Q --> Q1[Port 80 and 443 - public]
    Q1 --> Q2[/api/* and /hubs/* → backend:5062]
    Q1 --> Q3[/* → frontend:3000]
    Q2 --> P
    Q3 --> P
```

