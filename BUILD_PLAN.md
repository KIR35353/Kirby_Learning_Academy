# Kirby Learning Academy — Enterprise LMS Build Plan

## Overview

**Application:** Kirby Learning Academy  
**Client:** Kirby Corporation (Marine Transportation / Distribution & Services)  
**Branding:** Modeled after [kirbycorp.com](https://www.kirbycorp.com) — professional corporate, navy/dark-blue palette, clean and authoritative industrial style  
**Critical Compliance Domains:** OSHA, USCG, environmental, maritime safety regulations

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 15 (App Router) + TypeScript | SSR/SSG, API Routes, file-based routing, full-stack capability |
| **UI** | Tailwind CSS + shadcn/ui | Rapid, accessible, themeable components |
| **Database** | PostgreSQL 16 | Relational integrity, JSONB for flexible metadata, strong audit support |
| **ORM** | Prisma | Type-safe queries, migrations, multi-schema multi-tenant support |
| **Auth** | NextAuth.js v5 (Auth.js) | SSO/SAML, LDAP/AD adapters, JWT + database sessions |
| **File Storage** | AWS S3 (or Azure Blob) | CBT course bundles, certificates, attachments |
| **Background Jobs** | BullMQ + Redis | Notifications, recertification reminders, scheduled assignments |
| **Caching** | Redis | Session store, rate limiting, leaderboard data |
| **Email** | Resend (or SendGrid) | Transactional emails, compliance alerts |
| **Search** | PostgreSQL FTS → Meilisearch | Course catalog search, skills/competency lookup |
| **CBT Authoring** | Existing CBT template system (`_build_course.ps1` + manifest + HTML templates) | Courses are authored externally and uploaded to the LMS as a zip |
| **PDF Generation** | React PDF | Certificates, compliance reports, audit exports |
| **Charts** | Recharts | Dashboards, gap analysis visualizations |
| **Testing** | Vitest + Playwright | Unit, integration, and E2E tests |
| **CI/CD** | GitHub Actions | Automated build, test, and deployment pipeline |
| **Hosting** | AWS (ECS Fargate) or Azure App Service | Cloud-scalable, HA-ready |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 15 App                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Student UI  │  │  Admin UI    │  │  Manager UI   │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                    App Router / RSC                      │
├─────────────────────────────────────────────────────────┤
│               Next.js API Routes (tRPC)                  │
│  Auth │ Users │ Courses │ Compliance │ Reports │ Jobs    │
├──────────────────────┬──────────────────────────────────┤
│   PostgreSQL (Prisma)│  Redis (BullMQ + Cache)          │
│   Multi-tenant schema│  Job queues, sessions            │
└──────────────────────┴──────────────────────────────────┘
         │                          │
     AWS S3                     Meilisearch
  (CBT bundles/Certs)          (Course Search)
```

### Multi-Tenancy Strategy
- **Schema-per-tenant** in PostgreSQL for full data isolation between business units
- Tenant resolution via subdomain (`maritime.kirbyacademy.com`) or header
- Shared authentication layer; tenant context injected at middleware level

### RBAC Model
| Role | Scope |
|---|---|
| Super Admin | Platform-wide; all tenants |
| Tenant Admin | Single business unit |
| Compliance Officer | Read/write compliance records, reports |
| Manager | Assign courses, view team reports |
| Instructor | Create/manage courses |
| Employee | Enroll, complete courses |
| Contractor | Restricted catalog; no internal content |

---

## Database Schema (Core Entities)

```
tenants → users → enrollments → course_completions (score, passed, completed_at)
                ↓
           certifications → certification_history
                ↓
         compliance_records → audit_logs

courses (CBT bundles)  — metadata only; content lives in S3
        → course_versions (S3 prefix, manifest snapshot)
        → course_tags
        → learning_paths → learning_path_courses
        → curricula → curriculum_courses

skills → competency_matrix → gap_analysis_reports

standalone_assessments → questions → attempts  — for non-CBT checks/attestations

notifications → notification_logs
jobs → job_schedules (recurrence rules)
```

---

## Phases & Milestones

---

### Phase 1 — Foundation & Branding (Week 1–2)

**Goal:** Runnable app skeleton with full Kirby branding applied.

#### Tasks
- [ ] Initialize Next.js 15 project with TypeScript, Tailwind CSS, ESLint, Prettier
- [ ] Configure Tailwind theme with Kirby brand tokens:
  - Primary: Navy blue (`#003366` / Kirby dark blue)
  - Accent: Gold/amber (`#C8922A`)
  - Neutral grays, white backgrounds
  - Font: Inter or similar clean sans-serif
- [ ] Install shadcn/ui, configure with Kirby color palette
- [ ] Add `kirby_learning_academy_logo.png` and `favicon.ico` to global layout
- [ ] Build shared layout components: `TopNav`, `Sidebar`, `Footer`, `PageShell`
- [ ] Set up PostgreSQL (Docker Compose for local dev), configure Prisma
- [ ] Create initial Prisma schema: `Tenant`, `User`, `Session`
- [ ] Run first migration; seed dev tenant and admin user
- [ ] Configure environment variables: `.env.local`, `.env.example`
- [ ] Set up GitHub repo, branch strategy (`main` → `develop` → feature branches)
- [ ] Configure CI pipeline (lint, typecheck, test on PR)

**Deliverable:** Branded shell app, auth-ready DB, CI running.

---

### Phase 2 — Authentication & User Management (Week 3–4)

**Goal:** Secure, role-aware login with SSO readiness.

#### Tasks
- [ ] Integrate NextAuth.js v5:
  - Credentials provider (email/password, bcrypt)
  - SAML 2.0 provider (Azure AD / Okta for SSO)
  - LDAP/Active Directory provider
- [ ] Implement JWT + DB session hybrid strategy
- [ ] Build RBAC middleware: route-level and component-level guards
- [ ] Prisma schema: `Role`, `Permission`, `UserRole`, `UserTenant`
- [ ] User management UI (Admin):
  - User list with filters (department, location, role, status)
  - Create / edit / deactivate users
  - Bulk import via CSV
- [ ] Contractor / external user flag and segregated catalog access
- [ ] Department, Location, Job Title master data management
- [ ] User profile page (employee view): avatar, bio, role, certifications widget
- [ ] Password reset flow with secure token email

**Deliverable:** Working auth, SSO skeleton, full CRUD user management.

---

### Phase 3 — Organization & HRIS Integration (Week 5–6)

**Goal:** Organizational hierarchy synced with HR systems.

#### Tasks
- [ ] Prisma schema: `Department`, `Location`, `BusinessUnit`, `JobTitle`
- [ ] Org hierarchy tree UI (admin) with drag-and-drop reorder
- [ ] HRIS integration layer (abstract adapter pattern):
  - Workday adapter (REST)
  - SAP SuccessFactors adapter (OData)
  - Generic CSV/SFTP import for systems without APIs
- [ ] BullMQ job: scheduled nightly HRIS sync
- [ ] Auto-provision users on HRIS sync; deactivate on termination
- [ ] Role-change detection → trigger training reassignment event
- [ ] Hire date detection → trigger onboarding learning path assignment
- [ ] Multi-tenant admin: manage multiple business units from Super Admin console

**Deliverable:** Live org hierarchy, HRIS auto-sync, event triggers wired.

---

### Phase 4 — Course Publishing & Content Management (Week 7–9)

**Goal:** Admins can publish CBT courses built with the existing template system; learners can browse the catalog.

#### How CBT courses are authored
Courses are built **outside the LMS** using the existing CBT template system:
1. Author creates content screens (HTML files) using the layout templates (`_TPL_*.html`)
2. Author fills in `_course_manifest.json` with narration scripts, quiz questions, metadata
3. Author runs `_build_course.ps1` — outputs a folder of self-contained HTML files
4. Author zips the folder and uploads it to the LMS

The LMS is responsible for **hosting, tracking, and managing** those course bundles — not authoring them.

#### Tasks
- [ ] Prisma schema: `Course`, `CourseVersion`, `CourseTag`, `CourseLanguage`
- [ ] Admin: Course upload UI — drag-and-drop zip upload → extract to S3 bucket path `courses/{courseId}/{version}/`
- [ ] Zip validation on upload: confirm `CBT_Introduction.html` and `_course_manifest.json` are present
- [ ] Parse `_course_manifest.json` on upload to auto-populate: title, course ID, duration badge, sections count, objectives
- [ ] Admin: Course metadata form — description, category, tags, thumbnail, target audience, compliance tags
- [ ] Version management: upload new zip as new version; prior version preserved; admin selects active version
- [ ] Draft → Review → Published workflow; published courses appear in learner catalog
- [ ] Archive / retire a course (hides from catalog; preserves all enrollment and completion history)
- [ ] Searchable course catalog page (Meilisearch index rebuilt on publish)
- [ ] Course detail page: objectives, duration, sections, audience, completion rate badge
- [ ] Content library: PDFs, SOPs, manuals uploadable as standalone reference documents (S3)

**Deliverable:** Admins can upload CBT zips; catalog is live and searchable.

---

### Phase 5 — Learning Delivery & Enrollment (Week 10–11)

**Goal:** Students can be assigned and can self-enroll in courses; CBT launches in-browser and reports completion back to the LMS.

#### How CBT tracking works
The CBT template system's `_TPL_exam.html` already has a `buildResult()` function with an `if (pass)` branch. A **one-line `postMessage` addition** to the template is all that is needed:

```js
// Added to _TPL_exam.html inside the `if (pass)` block in buildResult()
window.parent.postMessage(
  { type: 'KLA_COMPLETE', courseId: '{{COURSE_ID}}', score: pct, passed: true },
  '*'
);
```

The LMS wraps the CBT in an `<iframe>` and listens for this message:

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'KLA_COMPLETE') {
    fetch('/api/enrollments/complete', {
      method: 'POST',
      body: JSON.stringify({ enrollmentId, score: e.data.score })
    });
  }
});
```

When the CBT is run **standalone** (no LMS), `postMessage` fires to a non-existent parent and is silently ignored — zero breakage to the standalone workflow.

#### Tasks
- [ ] Add `postMessage` completion hook to `_TPL_exam.html` in the CBT template system
- [ ] Prisma schema: `Enrollment`, `EnrollmentStatus`, `CourseCompletion`
- [ ] Searchable, filterable student course catalog
- [ ] Self-enrollment for open courses; approval workflow for restricted courses
- [ ] Manual course assignment (Admin/Manager → User or Group)
- [ ] Role-based training assignment rules engine:
  - Assign by job title, department, location, business unit, hire date
  - Rule builder UI with AND/OR logic
- [ ] CBT launch page: full-page `<iframe>` loading `CBT_Introduction.html` from the course's S3 path (signed URL)
- [ ] `postMessage` listener on the launch page → `POST /api/enrollments/complete` → record completion + score
- [ ] Track launch timestamp (enrollment `started_at`) and completion timestamp
- [ ] Student dashboard: My Courses, In Progress, Completed, Upcoming Due Dates
- [ ] Visual progress indicators: status badges (Not Started / In Progress / Complete / Passed / Failed)
- [ ] Resume: re-launch drops learner back to `CBT_Introduction.html` (CBT has internal section navigation)

**Deliverable:** Full enrollment-to-completion flow; CBT launches and reports pass/score to LMS.

---

### Phase 6 — Learning Paths & Curricula (Week 12)

**Goal:** Structured multi-course learning journeys and role-based curricula.

#### Tasks
- [ ] Prisma schema: `LearningPath`, `LearningPathCourse`, `Curriculum`, `CurriculumAssignment`
- [ ] Learning path builder: ordered sequence of courses with prerequisites
- [ ] Prerequisites: block next course until prior course/score threshold met
- [ ] Curricula: named bundles of learning paths assigned to roles/departments
- [ ] Overall curriculum progress and completion tracking
- [ ] Curriculum assignment by role/department/hire type

**Deliverable:** Learning paths and curricula fully functional.

---

### Phase 7 — Standalone Assessments (Week 13–14)

**Goal:** LMS-level assessments for use cases *outside* of a CBT course — compliance knowledge checks, attestations, and skills verification that aren't tied to a specific CBT exam.

> Note: CBT courses already have a built-in final exam handled entirely within the CBT (`_TPL_exam.html`). The LMS receives only the pass/fail result and score via `postMessage`. The LMS does **not** re-implement quiz logic for CBT content. This phase covers the *separate* need for standalone assessments.

#### Use cases
- Annual compliance attestations ("I have read and understood the Safe Work Policy")
- Standalone skills verification quizzes assigned by HR
- Pre/post assessments around CBT courses to measure knowledge lift
- Manager-assigned competency checks not linked to a specific course

#### Tasks
- [ ] Prisma schema: `StandaloneAssessment`, `Question`, `QuestionOption`, `AssessmentAttempt`, `AttemptAnswer`
- [ ] Question types: multiple choice, true/false, multi-select, attestation (acknowledge + sign-off)
- [ ] Question bank with tagging; random draw from pool
- [ ] Assessment settings: passing score, max attempts, time limit (optional)
- [ ] Attempt tracking: all attempts stored immutably for audit
- [ ] Automatic grading; certificate/badge trigger on pass
- [ ] Remediation link: on failure, recommend or auto-assign a CBT course to address the gap
- [ ] Results UI: attempt history, per-question breakdown

**Deliverable:** Standalone assessment engine live; attestation workflow working.

---

### Phase 8 — Skills Matrix & Competency Tracking (Week 15)

**Goal:** Measurable skill proficiency tracking and gap identification.

#### Tasks
- [ ] Prisma schema: `Skill`, `SkillCategory`, `CompetencyLevel`, `UserSkill`, `RoleSkillRequirement`
- [ ] Skills library: define skills with categories and proficiency levels (1–5 or custom)
- [ ] Role skill requirement mapping: required skills and minimum levels per job title
- [ ] Course → skill mapping: completing a course grants skill credit
- [ ] Assessment score → competency level mapping
- [ ] Manual skill endorsement (Manager can attest employee skill level)
- [ ] Skills matrix view: employee × skill grid with level indicators
- [ ] Gap analysis report: required vs. achieved per employee, team, or department
- [ ] Recommended courses to close gaps (auto-suggested)

**Deliverable:** Skills matrix, competency tracking, and gap analysis live.

---

### Phase 9 — Compliance & Certification (Week 16–18)

**Goal:** Full compliance lifecycle for industrial/maritime regulatory requirements.

#### Tasks
- [ ] Prisma schema: `Certification`, `CertificationRecord`, `CertificationHistory`, `ComplianceRequirement`, `AuditLog`, `Attestation`
- [ ] Certification types: initial, renewal, recertification (with intervals)
- [ ] Supported regulatory frameworks: OSHA, USCG, EPA, ISM Code, STCW, DOT
- [ ] Compliance requirement rules: mandatory by job/location/vessel/department
- [ ] Certification status tracking: Valid, Expiring Soon, Expired, Pending
- [ ] Expiration date management with configurable alert windows (e.g., 90/60/30 days)
- [ ] Automated renewal workflow:
  - BullMQ job scans expiring certs daily
  - Auto-assigns renewal course to employee
  - Emails employee and manager with escalation schedule
- [ ] Digital sign-off / attestation: employee acknowledges receipt of training; stored with timestamp and IP
- [ ] Immutable audit log: every certification state change recorded with actor, timestamp, reason
- [ ] Compliance dashboard (Compliance Officer): org-wide status by site/unit/vessel
- [ ] Regulatory reporting exports: CSV, PDF, Excel (filterable by reg body, date range, unit)
- [ ] Third-party cert upload: upload scanned external certifications with metadata
- [ ] Recurrent training scheduler: annual, quarterly, custom interval recurring assignments

**Deliverable:** Complete compliance lifecycle; audit-ready; regulatory exports working.

---

### Phase 10 — Reporting & Analytics (Week 19–20)

**Goal:** Data-driven dashboards and exportable reports for all stakeholders.

#### Tasks
- [ ] **Super Admin / Compliance Officer Dashboard:**
  - Org-wide training completion rate
  - Compliance status heatmap by site / business unit
  - Expiring certifications widget
  - Overdue training by department
- [ ] **Manager Dashboard:**
  - Team completion status
  - Individual employee training timeline
  - Gap analysis summary
- [ ] **Student Dashboard:**
  - My progress, achievements, upcoming deadlines
  - Completion history timeline
- [ ] Report Builder:
  - Parameterized reports: date range, user group, course, certification type
  - Saved report templates
  - Scheduled report delivery via email (BullMQ)
- [ ] Standard reports:
  - Training completion by course / department / user
  - Compliance status by regulation
  - Certification expiration roster
  - Assessment score distributions
  - Course effectiveness (completion rate, avg score, drop-off point)
  - User activity / login logs
- [ ] Export formats: CSV, Excel (xlsx), PDF
- [ ] Recharts visualizations: bar, line, pie, radar (skills), heat map

**Deliverable:** All dashboards and standard reports live with export.

---

### Phase 11 — Automation & Notifications (Week 21–22)

**Goal:** Zero-touch training workflow automation.

#### Tasks
- [ ] BullMQ job infrastructure: queues, workers, retry logic, dead-letter queue
- [ ] Automated assignment triggers:
  - New hire → assign onboarding curriculum
  - Role change → delta assignment (add new requirements, notify of removed)
  - Transfer to new location → location-specific compliance requirements
  - Cert expiry approaching → assign renewal course
- [ ] Notification system:
  - In-app notification center (bell icon, real-time via polling or SSE)
  - Email notifications via Resend (templated, branded)
  - Notification preferences per user (opt-out per notification type)
- [ ] Notification types: course assigned, due soon, overdue, cert expiring, cert expired, course completed, badge earned
- [ ] Manager escalation: notify manager when employee is overdue by X days
- [ ] Recurrent training: cron-based rescheduling of annual/quarterly courses
- [ ] Bulk notification broadcast (Admin): announcement to all or filtered users

**Deliverable:** Fully automated assignment and notification engine.

---

### Phase 12 — Engagement & Social Learning (Week 23–24)

**Goal:** Drive participation and knowledge-sharing through gamification and community.

#### Tasks
- [ ] Prisma schema: `Badge`, `UserBadge`, `Certificate` (digital), `ForumThread`, `ForumPost`, `Rating`, `KnowledgeCommunity`
- [ ] Digital certificates:
  - Auto-generated PDF on course/path completion using React PDF
  - Branded with Kirby Learning Academy logo
  - Unique verification code / QR code
  - Downloadable and shareable
- [ ] Badges and achievements:
  - Predefined badge library (completion, streak, top scorer, compliance champion)
  - Custom badge creation (Admin)
  - Badge display on user profile
- [ ] Leaderboards:
  - Configurable scope: department, site, company-wide
  - Opt-out toggle per user (respecting culture preferences)
  - Metrics: completions, points, streak
- [ ] Discussion forums:
  - Per-course Q&A boards
  - General knowledge-sharing communities
  - Moderation tools (Admin/Instructor)
  - Threaded replies, markdown support
- [ ] Peer ratings: course ratings and comments after completion
- [ ] Knowledge-sharing communities: topic-based groups with file sharing

**Deliverable:** Gamification, certificates, and social learning features live.

---

### Phase 13 — Enterprise Hardening & Integration (Week 25–28)

**Goal:** Production-ready, secure, scalable enterprise deployment.

#### Tasks
- [ ] **Security:**
  - Full OWASP Top 10 audit and remediation
  - Rate limiting on all API routes (Redis-backed)
  - Input validation and sanitization (Zod schemas on all mutations)
  - CSRF protection (built into NextAuth.js)
  - Secure file upload validation (type, size, virus scan via ClamAV or cloud service)
  - Signed S3 URLs (short-lived, no public bucket access)
  - Row-level security in PostgreSQL per tenant
  - Secrets management via AWS Secrets Manager / Azure Key Vault
  - Security headers (CSP, HSTS, X-Frame-Options) via Next.js middleware
- [ ] **SSO / Identity:**
  - SAML 2.0 integration with Azure AD / Okta
  - SCIM 2.0 for automated user provisioning/deprovisioning
  - MFA support
- [ ] **Data Export & Compliance APIs:**
  - Regulatory export API (authenticated, audited access)
  - Data portability export (GDPR-style user data export)
  - Audit log API for external SIEM integration
- [ ] **Performance & Scalability:**
  - Database query optimization (indexes, explain analyze)
  - Next.js ISR/caching strategy for catalog pages
  - Redis caching for expensive report queries
  - Horizontal scaling via stateless app design (sessions in Redis/DB)
  - CDN for static assets and course content (CloudFront / Azure CDN)
- [ ] **High Availability:**
  - Multi-AZ PostgreSQL (RDS or Azure Database)
  - Redis Cluster or ElastiCache
  - Auto-scaling container deployment (ECS Fargate or AKS)
  - Health check endpoints and uptime monitoring
- [ ] **Observability:**
  - Structured logging (Pino) with log aggregation (CloudWatch / Datadog)
  - Error tracking (Sentry)
  - Performance monitoring (OpenTelemetry)
  - Alerting on SLA thresholds
- [ ] **Backup & Recovery:**
  - Automated daily DB snapshots with point-in-time recovery
  - S3 versioning enabled on content bucket
  - Documented RTO/RPO targets
- [ ] **Accessibility:**
  - WCAG 2.1 AA compliance audit (axe-core in CI)
  - Keyboard navigation for course player and all forms
  - Screen reader compatibility
- [ ] **UAT & Load Testing:**
  - Playwright E2E test suite covering critical paths
  - k6 load test: 500 concurrent users through course player
  - Pen test engagement (internal or third-party)

**Deliverable:** Production-ready, security-hardened, HA deployment.

---

## Project Structure

```
kirby-learning-academy/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Login, SSO callback, password reset
│   │   ├── (student)/              # Student-facing pages
│   │   │   ├── dashboard/
│   │   │   ├── catalog/
│   │   │   ├── my-courses/
│   │   │   └── player/[enrollmentId]/     # CBT iframe launch + postMessage listener
│   │   ├── (admin)/                # Admin console
│   │   │   ├── users/
│   │   │   ├── courses/
│   │   │   ├── compliance/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── (manager)/              # Manager views
│   │   └── api/                    # API route handlers
│   ├── components/
│   │   ├── ui/                     # shadcn/ui base components
│   │   ├── layout/                 # TopNav, Sidebar, PageShell
│   │   ├── courses/                # Course card, player, progress
│   │   ├── compliance/             # Cert tracker, compliance dashboard
│   │   └── charts/                 # Recharts wrappers
│   ├── lib/
│   │   ├── auth/                   # NextAuth config, adapters
│   │   ├── db/                     # Prisma client singleton
│   │   ├── jobs/                   # BullMQ queue definitions
│   │   ├── hris/                   # HRIS adapter interfaces and implementations
│   │   ├── cbt/                    # Zip validation, manifest parsing, S3 publish helpers
│   │   ├── s3/                     # S3 upload/download helpers
│   │   ├── email/                  # Resend email templates
│   │   └── utils/
│   ├── server/
│   │   ├── routers/                # tRPC routers
│   │   └── trpc.ts
│   └── types/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── workers/                        # BullMQ worker processes
│   ├── notification.worker.ts
│   ├── hris-sync.worker.ts
│   └── recertification.worker.ts
├── public/
│   ├── kirby_learning_academy_logo.png
│   └── favicon.ico
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                        # Playwright
└── docker-compose.yml              # PostgreSQL, Redis, Meilisearch (local dev)
```

---

## Development Sequence Summary

| Phase | Focus | Duration |
|---|---|---|
| 1 | Foundation, branding, DB setup | Week 1–2 |
| 2 | Auth, RBAC, user management | Week 3–4 |
| 3 | Org hierarchy, HRIS integration | Week 5–6 |
| 4 | CBT upload, publishing, catalog | Week 7–9 |
| 5 | Enrollment, CBT player, completion tracking | Week 10–11 |
| 6 | Learning paths, curricula | Week 12 |
| 7 | Standalone assessments, attestations | Week 13–14 |
| 8 | Skills matrix, competency, gap analysis | Week 15 |
| 9 | Compliance, certifications, audit | Week 16–18 |
| 10 | Reporting, analytics dashboards | Week 19–20 |
| 11 | Automation, notifications | Week 21–22 |
| 12 | Engagement, gamification, social | Week 23–24 |
| 13 | Security hardening, SSO, HA, UAT | Week 25–28 |

**Total estimated timeline: ~28 weeks** (with a focused team of 3–5 engineers)

---

## Key Technical Decisions & Risks

| Decision | Rationale |
|---|---|
| CBT template system for authoring | Already built, mature, and battle-tested. LMS hosts the output; no need to rebuild a course editor |
| `postMessage` for CBT completion tracking | 3 lines of code in `_TPL_exam.html`; backward-compatible; works standalone and in-LMS |
| Next.js full-stack (not separate API) | Reduces ops complexity; API routes + React Server Components cover all LMS needs |
| Schema-per-tenant multi-tenancy | Strongest data isolation; required for enterprise/compliance customers |
| tRPC over REST | End-to-end type safety; eliminates API contract drift |
| BullMQ over cron | Reliable retries, visibility, rate limiting for compliance alert workflows |
| PostgreSQL FTS first, Meilisearch later | Reduce infrastructure initially; migrate if search performance requires it |

| Risk | Mitigation |
|---|---|
| HRIS API access varies by client | Build adapter interface pattern; ship CSV fallback from Day 1 |
| CBT postMessage origin security | Restrict `postMessage` listener to the known S3/CDN origin; validate `enrollmentId` server-side |
| SAML SSO setup per tenant | Build self-service SSO config UI in admin panel |
| Regulatory requirement changes | Compliance rules stored as data (not hard-coded); Admin can update |
| Data volume for large orgs | Pagination, cursor-based queries, report async generation from Phase 10 |

---

## Definition of Done (per Phase)

- All features in phase tasks checked off
- Unit tests for all business logic (≥80% coverage)
- E2E tests for critical user flows
- No TypeScript errors (`tsc --noEmit` passes)
- No ESLint errors
- Accessibility: axe-core scan passes for new pages
- PR reviewed and merged to `develop`
- Staging environment updated and smoke-tested
