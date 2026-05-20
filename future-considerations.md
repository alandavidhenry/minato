# Future Considerations

## Business Context

This app is a health and safety document management platform. The primary customer is a small H&S consultancy (two to three employees) that serves up to 100 client businesses. The consultancy (Simon's business) is the initial and currently only tenant. Alan is the sole developer.

The platform may eventually be marketed to other H&S companies or to businesses that manage their own H&S compliance — this is a meaningful SaaS pivot that should inform architectural decisions now.

---

## Workflow Implementation Plan

This section maps Simon's stated workflow (see README "How It Works") to the current implementation, identifies gaps, and prioritises remaining work.

### Status summary

| Step | Feature | Status |
|---|---|---|
| 1 | Document upload + indexing (ref, name, date, version) | ✅ Done (blob storage + template record) |
| 2 | Comprehension questions per document | ✅ Done — admin builder + server-side validation + customer answer form |
| 3 | Job role-based assignment to individuals | ✅ Done — individual-level assignment (userId nullable), company-wide stays as before |
| 4a | Email notification on assignment | ⬜ Not started |
| 4b | No-email worker name-entry sign-off | ⬜ Not started |
| 4c | Line manager reminder for no-email workers | ⬜ Not started |
| 5 | Read + answer questions + digital sign-off | ⬜ Partial — sign-off done, questions done, signature pad not yet |
| 6a | Completed vs overdue report | ✅ Done — `dueDate` on assignments; admin completions view shows per-assignment breakdown (completed vs outstanding) with overdue badge |
| 6b | Automated reminder notifications for overdue | ⬜ Not started |
| 7/8 | New document version triggers new assignment cycle | ⬜ Not started |

### Priority order and detail

#### P1 — Comprehension questions ✅ Done
Admin defines 2–3 multiple-choice questions per template via the Edit Template dialog — each question has a set of options and one marked as correct. Options are shown to customers as radio buttons; the correct answer is stored server-side only. On the customer completion page, questions appear as a "Comprehension Check" section; answers are validated server-side on submission (exact string match against the correct option). Wrong answers return HTTP 400 with `failedQuestionIds`; the UI highlights failed questions and lets the customer re-select and resubmit.

Key files: `src/types/comprehension-question.ts`, `src/lib/document-templates.ts` (`questions` field), `src/lib/assignments.ts` (strips answers before returning to client), `src/app/api/customer/assignments/[id]/complete/route.ts` (validates answers), `src/components/admin/edit-template-dialog.tsx` (question builder), `src/app/customer/documents/[assignmentId]/complete/page.tsx` (answer form).

#### P2 — Individual-level assignment and overdue tracking ✅ Done

- ✅ `dueDate DateTime?` on `Assignment`; set via admin assign dialogs (both company-wide and individual)
- ✅ `getAssignmentStatusSummary` in `src/lib/completion-records.ts` — returns completed users, outstanding users, isOverdue
- ✅ Admin completions view (`/admin/completions/[companyId]/[assignmentId]`) shows completed + outstanding sections with overdue badge
- ✅ Company completions list (`/admin/completions/[companyId]`) now shows ALL assignments (not just those with completions), with status/overdue/outstanding count columns and due date
- ✅ Company detail page shows due date column in both assignment tables

#### P3 — Job role-based assignment
Simon wants documents to be filtered by employee job role (e.g. Engineers only see engineering docs). This reduces admin overhead when assigning documents to large companies.

- Add `jobRole` field to `User` (nullable string or enum — confirm with Simon whether roles are fixed or freeform)
- Add `targetJobRoles` JSON field to `Assignment` (array of job role strings; empty = all users in company)
- Customer documents page filters assignments by the signed-in user's job role
- Admin assignment UI allows selecting which job roles the document applies to

#### P4 — Email notifications on assignment
When a document is assigned, relevant users should receive an email with a link to complete it.

- Reuse the existing Azure Communication Services email infrastructure
- Trigger email on assignment creation (or batch on a schedule if many users)
- Email contains: document name, due date, direct link to the completion page
- Requires the assignment to know which individual users are in scope (P2 + P3 prerequisite)

#### P5 — Automated reminder notifications
Chase overdue sign-offs automatically.

- Configurable reminder schedule per assignment (e.g. 3 days before due, 1 day before, day of, then weekly)
- For users with email: send directly
- For users without email: send to line manager (see P6)
- Implementation options: Azure Functions timer trigger (simplest for Azure stack), or a Next.js cron via Vercel/custom scheduler

#### P6 — No-email worker support and line manager routing
Some workers have no email address. Simon's spec: they use a name-entry field to sign off, and reminders go to their line manager.

- Allow a `User` to have no email (currently email is required for auth)
- Two sign-off modes: authenticated (email login) and name-entry (no account required — name captured at completion time)
- Add `lineManagerId` (nullable FK to another `User`) or `lineManagerEmail` (nullable string) to `User`
- For no-email users, all email notifications route to their line manager instead
- The `CompletionRecord` stores either `userId` (authenticated) or `signerName` (name-entry), not both

#### P7 — Document version cycle
When Simon uploads a new version of a document, the new version should trigger a fresh assignment + completion cycle.

- `DocumentTemplate` already has a version concept (blobPath versioning)
- Make version explicit: add `version` integer to `DocumentTemplate`, auto-incremented on update
- When a new version is published, create new `Assignment` records (linked to new template version) for all previously assigned companies
- Old `CompletionRecord`s remain attached to their original template version — do not invalidate historical sign-offs
- Admin report shows completion status per version, per company

---

## Document Model

### Current state (as of 2026-04)
Files are stored as blobs in Azure Blob Storage with a hierarchical path structure. The template → assignment → completion flow is now partially built:

- **Templates** — created and managed by admins; each template has a `formSchema` (JSON array of `FormField`) defining what the customer fills in; admin can edit via the form field builder in `/admin/templates`
- **Assignments** — templates assigned to customer companies; visible to customers at `/customer/documents`
- **Completions** — customers navigate to `/customer/documents/[assignmentId]/complete`, fill in the form, and submit; `CompletionRecord` is written with `formData`; PDF uploaded to `completions/{recordId}.pdf`; customer and admin can download signed PDF
- **Customer documents page** — shows assigned documents with Pending/Complete badges; "Fill In & Complete" navigates to the form page; "Mark Complete" for no-form templates works directly

All of Steps 1–8 are now complete:
- ✅ Form schema on templates (admin form field builder)
- ✅ Customer form page at `/customer/documents/[assignmentId]/complete`
- ✅ Required-field validation in the complete API
- ✅ PDF generation via `@react-pdf/renderer` (`src/lib/pdf/completion-pdf.tsx`); uploaded to Blob Storage at `completions/{recordId}.pdf`
- ✅ Customer can download their signed PDF from `/customer/documents`
- ✅ Admin completions view at `/admin/completions` with per-record PDF download
- ✅ Customer users must be linked to a company at creation time (or via role change); `Create User` and `Change Role` dialogs now include a company selector for customer roles
- ✅ Individual-level assignment — `Assignment.userId` nullable field; `userId = null` = company-wide (all users see it), `userId` set = only that user sees it; two partial unique indexes enforce uniqueness; admin can assign to individual users from the company detail page; customer sees company-wide + individual combined (deduplicated)

**Remaining for the completion flow:**
- Signature pad (canvas) — `react-signature-canvas`, embed drawn signature into PDF (Step 8)
- Data retention / immutability policy — prevent deletion of completion blobs

### Target model
The correct mental model is **templates → assignments → completions**:

- **Template library** — a set of reusable H&S documents (e.g. farmyard safety checklist, power tools checklist, food packing machine checklist). Maintained by the H&S consultancy admin.
- **Customer assignment** — each customer is assigned a subset of templates relevant to their business type (e.g. a farmer gets farmyard + power tools; a food factory gets power tools + food packing machine). Some templates may be customised per customer (e.g. arable farm vs livestock farm variant).
- **Completion/signing** — when a customer completes a document, it is signed and becomes immutable. The signed copy belongs to that customer only and is not visible to others. A signed PDF with audit trail is the target format.

This is an inherently relational model:
- Templates are shared across many customers
- Customers have many assigned templates
- Each assignment has a completion state, signer identity, and timestamp
- A company may have multiple users, each with access to a subset of that company's assigned documents

This model **cannot be cleanly implemented in Azure Table Storage** — see the Database section below.

---

## Data Layer: Azure Table Storage vs PostgreSQL

### Current approach (as of 2026-04)
User accounts and password reset tokens are stored in **Neon PostgreSQL** via **Prisma ORM**. Activity logs remain in Azure Table Storage (well-suited to append-only, time-series data with no relational queries).

**Migration completed:** `prisma/schema.prisma` defines `Tenant`, `User`, and `PasswordReset` models. The schema includes a nullable `tenantId` on `User` so multi-tenancy can be enforced later without a schema change. The Prisma client is generated to `src/generated/prisma/` and accessed via a singleton at `src/lib/prisma.ts` using `@prisma/adapter-pg`.

**What stays in Azure Storage:**
- Blob Storage — all file storage stays here permanently
- Table Storage — activity logs only (no change needed)

### Why PostgreSQL was needed
The document model (templates → assignments → completions) requires:
- Many-to-many relationships (customers ↔ templates)
- Per-assignment state (completed, signed, by whom, when)
- Per-user access scoping within a company
- Transactional writes (create assignment + log activity atomically)
- Relational queries ("which templates does this customer have?", "which customers have completed this template?")

Table Storage handles none of these well.

### Schema (current — as of 2026-04)

```
Tenant              — one row per H&S company using the platform (future multi-tenancy; populated when needed)
User                — belongs to a Tenant; has a Role; customer-role users also link to a CustomerCompany
PasswordReset       — one token per user; expires after 1 hour
CustomerCompany     — a client business; belongs to a Tenant
DocumentTemplate    — a reusable H&S document; belongs to a Tenant; blobPath nullable (form-only templates)
Assignment          — links a DocumentTemplate to a CustomerCompany (company-wide, userId=null) or to a specific User (individual, userId set); partial unique indexes enforce uniqueness per scope
CompletionRecord    — a customer user's signed completion; blobPath nullable until PDF generation is built; formData Json? for Document Intelligence
```

No separate `CustomerUser` model — the existing `User` model covers customer users via `customerCompanyId` (nullable; set for Customer Admin / Customer User roles, null for consultancy staff).

### Remaining deployment work
- Migrate existing users from Azure Table Storage to PostgreSQL (one-time data migration script needed if there are production users)
- Run `terraform apply` to provision the `database-url` Key Vault secret and App Service setting in each environment

---

## Role Model

### Current roles (as of 2026-04)
Five roles are implemented, stored as strings in the `User.role` column and attached to the JWT at sign-in. Defined in `src/types/rbac.ts`.

| Role | Description | Admin portal access |
|---|---|---|
| `Platform Admin` | Alan — manages tenants, billing, platform config | Yes |
| `Tenant Admin` | H&S consultancy admin (Simon) — manages templates, customers, users | Yes |
| `Tenant Staff` | H&S consultancy employee — can view documents and activity logs | No |
| `Customer Admin` | A client company's manager — view documents and users | No |
| `Customer User` | An individual within a client company — view and download docs only | No |

`ADMIN_ROLES` (`Platform Admin`, `Tenant Admin`) is used as the gate for all admin API routes and the admin portal UI. The `ROLE_PERMISSIONS` map in `rbac.ts` defines what each role can do.

### What remains
- Role assignments will need to be per-tenant once multi-tenancy is introduced — the JWT will need to carry tenant context alongside the role.
- `Read-only / Auditor` role deferred until a concrete use case appears.

---

## Electronic Signing

### Requirement
Customers need to sign completed documents. A signed document should be immutable, attributable to a specific user, and timestamped.

### Options (in order of complexity)

1. **Simple audit trail (recommended starting point)** — store signer identity, timestamp, and IP in a `CompletionRecord`. Generate a signed PDF using a server-side PDF library (see below). No external dependency, free, sufficient for most H&S compliance needs.

2. **Signature pad** — add a canvas-based signature capture (e.g. `react-signature-canvas`) that embeds a drawn signature image into the generated PDF. Adds a visual signature without external services. Still free.

3. **Third-party e-signing** (DocuSign, Adobe Sign, Yoti) — legally stronger, tamper-evident certificates, better audit trail. Costs money and adds integration complexity. Probably not needed until there is a specific legal or customer requirement.

Start with option 1 or 2. Option 3 is unlikely to be necessary for internal H&S compliance documents but should be revisited if customers or regulations require it.

---

## PDF Generation

### Requirements
- Convert web forms into PDFs
- Embed completion/signing metadata into the PDF
- PDFs must be immutable after signing

### Recommended approach
Use **`@react-pdf/renderer`** (React-PDF) — renders React components to PDF server-side. Works well in Next.js API routes. Free, no external dependency.

Workflow:
1. Customer fills in a web form (Next.js page)
2. On submission, a Next.js API route renders the form data as a PDF using React-PDF
3. The PDF is uploaded to Azure Blob Storage with a content hash in the path (makes it immutable by construction)
4. A `CompletionRecord` is written to the database with the blob path, signer identity, and timestamp
5. The original template is never modified

---

## Document Intelligence (Azure AI)

### Potential use
Azure Document Intelligence (formerly Form Recognizer) can extract structured data from uploaded PDFs and scanned documents — converting form fields into queryable JSON.

### When this makes sense
- If customers upload scanned paper forms that need to be processed into structured records
- If the platform needs to search or filter across form responses (e.g. "show all farms where the fire exit checklist was marked as non-compliant")
- If historical paper documents need to be ingested into the system

### Cost
Azure Document Intelligence has a free tier (500 pages/month). Beyond that it charges per page. For a small H&S consultancy this is likely within the free tier initially.

### Recommendation
Defer until there is a clear use case. The programmatic PDF generation approach (above) produces structured data natively — Document Intelligence is only needed when the source document is a scan or an unstructured upload. Design the `CompletionRecord` schema to include a `formData` JSON field from the start so structured data can be stored regardless of how it is captured.

---

## Multi-tenancy

### Current state
The app is single-tenant — one H&S company, one set of users, one document library.

### Future state
If the platform is marketed to other H&S companies, each company needs:
- Their own document template library
- Their own customer base
- Their own admin users
- Data isolation from other tenants

### Recommended approach: shared database, tenant-scoped rows

Add a `tenantId` foreign key to every table. All queries are scoped by `tenantId`. This is simpler to operate than separate databases per tenant and scales well to hundreds of tenants. Row-level security in PostgreSQL can enforce tenant isolation at the database level.

**Do not build this yet** — but design the schema with a `Tenant` table and `tenantId` columns from the start. Adding multi-tenancy to a schema that was designed for it is straightforward; retrofitting it is painful.

---

## Testing Strategy

### Current state
Vitest is configured. Unit and integration tests are in place. E2E tests are not yet written.

**Stack:**

| Layer | Tool | Status |
|---|---|---|
| Unit | Vitest | Done — full coverage of `src/lib/` and `src/lib/file-system/` |
| Integration | Vitest (direct route handler calls) | Done — health, admin user CRUD, forgot/reset password, all document routes |
| E2E | Playwright | Not yet started |
| Coverage | Vitest built-in (`v8`) | Configured |

**Integration tests cover all document routes** (`src/app/api/__tests__/documents.test.ts`): upload, download, delete, move, rename, share, versions — auth checks, validation, success paths, and failure paths for each.

**TDD workflow:**
1. Define interface types and function signatures first
2. Write tests against the interface (before implementation exists)
3. Implement to make the tests pass
4. Review both together

This works well and catches design problems early. Always request tests before implementation.

**Test discipline (non-negotiable):** update existing tests whenever code changes; write new tests whenever new code is added.

### What remains
- **E2E tests (Playwright)** — sign in, view documents, admin manages users. Add once the document model is more stable, as UI tests are brittle against layout changes. Add Playwright step to CI after the suite exists.

### Coverage target
High coverage on `src/lib/` (>90%) and critical API routes. E2E coverage of the five to ten most important user journeys. Do not chase 100% coverage at the expense of test quality.

---

## Free Tier Architecture

### Target: zero cost until paying customers exist

| Service | Free tier | Notes |
|---|---|---|
| Azure App Service | F1 (free) — 60 CPU min/day, 1 GB RAM | No custom domain SSL on F1; upgrade to B1 (~£10/month) when needed |
| Azure Blob Storage | 5 GB free (12 months), then ~£0.016/GB | Negligible cost for lots of small files |
| Azure Table Storage | 5 GB free (12 months) | Activity logs only once DB is migrated |
| Neon PostgreSQL | Free tier — 0.5 GB, auto-suspend | Sufficient for <100 customers; migrate to paid when needed |
| Azure Communication Services | 100 emails/day free | Already provisioned |
| Azure Document Intelligence | 500 pages/month free | Defer until needed |
| GitHub Actions | 2,000 min/month free (private repos) | Sufficient for CI/CD |
| GitHub Container Registry | Free for public images; 1 GB free for private | Already in use |

### When to start spending
- Custom domain + SSL certificate → upgrade App Service to B1
- Storage exceeds free tier → Blob Storage pricing is cheap, not a concern
- Database exceeds Neon free tier → migrate to Neon paid (~$19/month) or Azure Database for PostgreSQL (~£25-50/month)
- More than 100 emails/day → ACS pricing is low (£0.00025/email)

---

## Deployment Pipeline

### Current state
GitHub Actions: lint → security scan → Docker build/push → Azure deploy → release. Triggered on `main` (prod) and `dev` (dev environment) branches.

### Current state
Lint, format check, type check, and all Vitest tests (unit + integration) run on every PR and release via `lint-format.yml`.

### Gaps to address
- No E2E tests in the pipeline — add a Playwright step after the Docker build once E2E tests exist
- No staging environment — consider adding a `staging` branch/environment between `dev` and `main`
- No database migration step — ✅ Done. `prisma migrate deploy` runs in `azure-deploy.yml` before the App Service deploy step, using `DATABASE_URL` from GitHub environment secrets.
- No smoke test after deployment — a basic health check hit against the deployed URL would catch failed deploys earlier

### Recommended pipeline order (target state)
1. Lint + format check + type check + unit/integration tests (`npm run checks`) ✓ done
2. Docker build + push
3. E2E tests against the built app (Playwright) — not yet
4. Database migration (`prisma migrate deploy`) ✓ done — runs in `azure-deploy.yml` before deploy
5. Azure deploy
6. Post-deploy smoke test — not yet
7. Release tag

---

## Compliance & Data Protection

### GDPR (UK)
- All data is UK-resident (Azure UK South / UK West regions)
- Personal data includes: user names, email addresses, signed documents (may contain signatures, employee names)
- Retention policy needed: how long are completed/signed documents kept? Who can delete them?
- Right to erasure: design user deletion to anonymise rather than hard-delete where documents must be retained for compliance purposes

### Health & Safety regulations
- Signed H&S checklists may need to be retained for a defined period (typically 3-5 years under UK H&S law)
- The immutable signed PDF approach (content-addressed blob path) supports this naturally
- Audit trail in activity logs supports evidence of compliance

### Actions needed
- Add a data retention policy to the admin settings
- Add a privacy policy page
- Confirm with Simon whether any industry-specific H&S standards require certified e-signatures vs simple audit trails
