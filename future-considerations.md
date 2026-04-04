# Future Considerations

## Business Context

This app is a health and safety document management platform. The primary customer is a small H&S consultancy (two to three employees) that serves up to 100 client businesses. The consultancy (Simon's business) is the initial and currently only tenant. Alan is the sole developer.

The platform may eventually be marketed to other H&S companies or to businesses that manage their own H&S compliance — this is a meaningful SaaS pivot that should inform architectural decisions now.

---

## Document Model

### Current state
Files are stored as blobs in Azure Blob Storage with a hierarchical path structure. There is no concept of a document template or assignment — documents are uploaded and browsed.

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

### Current approach
User accounts, activity logs, and password reset tokens are stored in Azure Table Storage. This was pragmatic: Blob Storage is already required for files, and Table Storage comes free with the same storage account.

### Why it works now
- The current data model is flat — users have a role, logs are append-only, reset tokens are ephemeral
- No joins are needed yet
- Activity logs suit Table Storage well (high-volume, append-only, time-series)
- Zero marginal cost

### Why it will break down
The document model above requires:
- Many-to-many relationships (customers ↔ templates)
- Per-assignment state (completed, signed, by whom, when)
- Per-user access scoping within a company
- Transactional writes (create assignment + log activity atomically)
- Relational queries ("which templates does this customer have?", "which customers have completed this template?")

Table Storage handles none of these well. Attempting to implement this model in Table Storage will produce denormalised data, multiple round trips per query, and fragile manual consistency logic.

### Recommendation: migrate to PostgreSQL before building the document model

**For free tier:** Use [Neon](https://neon.tech) — a serverless PostgreSQL provider with a generous free tier (0.5 GB storage, auto-suspend when idle). Neon works well with Prisma and Next.js. When ready to move to paid, it can be migrated to Azure Database for PostgreSQL Flexible Server or kept on Neon.

**ORM:** Use Prisma — type-safe, excellent migration tooling, works well with Next.js App Router, and pairs naturally with TDD (generate types from schema, write tests against types, implement).

**What stays in Azure Storage:**
- Blob Storage — all file storage stays here permanently
- Table Storage — activity logs can stay (they suit Table Storage and don't need relational queries). Users table should migrate to PostgreSQL.

### Proposed schema (initial)

```
Tenant              — one row per H&S company using the platform (future multi-tenancy)
User                — belongs to a Tenant; has a Role
CustomerCompany     — a client business; belongs to a Tenant
CustomerUser        — a user within a CustomerCompany; has a Role
DocumentTemplate    — a reusable H&S document; belongs to a Tenant
Assignment          — links a DocumentTemplate to a CustomerCompany (or individual CustomerUser)
CompletionRecord    — when a CustomerUser signs an Assignment; stores signer, timestamp, blob path to signed PDF
```

---

## Role Model

### Current roles
`Admin`, `Customer` — coarse-grained, stored on the JWT.

### Roles needed (not yet fully decided)
The following are likely based on the business model:

| Role | Description |
|---|---|
| Platform Admin | Alan — manages tenants, billing, platform config |
| Tenant Admin | H&S consultancy admin (Simon) — manages templates, assigns documents to customers, manages customer accounts |
| Tenant Staff | H&S consultancy employee — can view all, limited management rights |
| Customer Admin | A client company's manager — can manage their own users |
| Customer User | An individual within a client company — accesses only their assigned documents |
| Read-only / Auditor | View access only, no signing |

Role assignments must be per-tenant once multi-tenancy is introduced. The current approach of attaching roles directly to the JWT will need to evolve to include tenant context.

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
- No database migration step — once Prisma is introduced, `prisma migrate deploy` must run as part of deployment before the app starts
- No smoke test after deployment — a basic health check hit against the deployed URL would catch failed deploys earlier

### Recommended pipeline order (target state)
1. Lint + format check + type check + unit/integration tests (`npm run checks`) ✓ done
2. Docker build + push
3. E2E tests against the built app (Playwright) — not yet
4. Database migration (`prisma migrate deploy`) — not yet
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
