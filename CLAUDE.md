# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run format:check # Check formatting without writing
npm run checks       # Run lint + format check + TypeScript type check + tests
npm test             # Run all tests (unit + integration)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

`npm run checks` is the full quality gate — run it before committing.

## Architecture

Document management platform built on **Next.js 16 App Router** with **Azure** as the backend infrastructure.

### Data Layer
- **Azure Blob Storage** — file storage, organized in hierarchical paths with versioning via naming convention; SAS tokens for secure temporary access (`src/lib/storage.ts`, `src/lib/file-system/`)
- **Azure Table Storage** — one table: `activityLogs` (audit trail only); accessed via `@azure/data-tables` (`src/lib/activity-logger.ts`)
- **Neon PostgreSQL + Prisma** — all relational data
  - Schema: `prisma/schema.prisma`; client generated to `src/generated/prisma/`; singleton at `src/lib/prisma.ts`; driver: `@prisma/adapter-pg`
  - Models: `Tenant`, `User`, `PasswordReset`, `CustomerCompany`, `DocumentTemplate`, `Assignment`, `CompletionRecord`
  - `User`: nullable `email?` and `passwordHash?` (no-email workers cannot log in); nullable `jobRole?`; nullable `lineManagerId?` self-ref FK → `User.id` (routes notifications to line manager)
  - `DocumentTemplate`: `formSchema Json?`; `questions Json?` — each question is `{ id, question, options: string[], answer: string }`; `version Int @default(1)` — incremented on each publish
  - `Assignment`: nullable `userId` (individual vs company-wide); nullable `dueDate?`; nullable `targetJobRoles Json?` (string array); `templateVersion Int @default(1)` — snapshot at assignment creation; partial unique indexes include `templateVersion`
  - Lib: `src/lib/customer-companies.ts`, `src/lib/document-templates.ts`, `src/lib/assignments.ts`, `src/lib/completion-records.ts`
  - Key functions: `getAssignmentStatusSummary` (completed records + outstanding users + isOverdue); `getAssignmentsForUser` (filters by `targetJobRoles`, deduplicates by highest-version per templateId — individual beats company-wide at same version); `publishNewTemplateVersion` (increments version, applies content updates); `createAssignmentsForNewVersion` (replicates all previous-version assignments at new version)
  - Prisma nullable JSON fields: use `Prisma.NullableJsonNullValueInput` / `Prisma.InputJsonValue` (imported from `@/generated/prisma/client`)
- **Azurite emulator** — set `USE_AZURITE=true` in `.env.local` for Azure Storage local development; PostgreSQL connects to Neon (or local DB) via `DATABASE_URL`

### Authentication
NextAuth.js v4 with Credentials provider. Users authenticate against Neon PostgreSQL via Prisma; passwords hashed with bcryptjs. Roles are attached to JWT tokens and exposed via session. `src/lib/auth.ts` is the central config; `src/types/next-auth.ts` extends session types; `src/types/rbac.ts` defines roles and permissions.

Password reset tokens are stored in the `PasswordReset` table in PostgreSQL and expire after 1 hour. See `src/lib/password-reset.ts`.

### Email
Transactional email is sent via **Azure Communication Services (Email)** (`@azure/communication-email`). An Azure-managed sending domain (`DoNotReply@<uuid>.azurecomm.net`) is provisioned by Terraform — no custom domain or DNS setup required. Free tier: 100 emails/day. ACS is provisioned as part of the IaC (`infrastructure/modules/communication_service/`).

Three email types are implemented via `src/lib/email.ts`:
- `sendAssignmentNotification(recipients, templateTitle, dueDate, baseUrl)` — triggered fire-and-forget from `POST /api/admin/companies/[id]/assignments` when an assignment is created; individual assignments notify the specific user, company-wide assignments notify all company users filtered by `targetJobRoles`; both paths call `resolveEmailRecipients` so no-email workers route to their line manager
- `sendReminderNotification(recipients, templateTitle, dueDate, isOverdue, baseUrl)` — called by the daily cron job; subject says "Reminder:" or "Overdue:" depending on `isOverdue`
- Password reset — inline in `src/app/api/auth/forgot-password/route.ts`

`resolveEmailRecipients(users: UserData[])` in `src/lib/user-database.ts` — resolves a list of users to `{ email, name }[]` recipients, routing no-email users to their line manager and deduplicating by email (so one manager only gets one notification even if they manage multiple no-email workers in the same batch).

Automated reminders: `src/lib/reminders.ts` exports `isReminderDay(dueDate, today)` (fires on days -3, -1, 0, -7, -14, … relative to due date) and `getAssignmentsNeedingReminders(today)` which queries all due-dated assignments, applies job role filtering, resolves email recipients (including line manager routing for no-email workers), and returns outstanding users per assignment. `GET /api/cron/reminders` is the protected endpoint (`Authorization: Bearer {CRON_SECRET}`). `.github/workflows/reminders.yml` runs the endpoint daily at 08:00 UTC using the `prod` environment.

### App Structure
```
src/app/
  admin/            # Admin dashboard (users, companies, templates, activity logs, settings)
  api/              # Route handlers — auth, documents, folders, scan, shorturl, health, admin/*, customer/*, signoff/*
  customer/         # Customer-facing pages (documents/assignments view)
  signoff/          # Public kiosk pages — no auth required; GET /signoff/[companyId] lists workers + assignments; POST /signoff/[companyId]/[assignmentId]/complete records sign-off
  documents/        # Consultancy staff file browser UI
  scan/             # Document scanning
  shared/           # Public shared document views
  s/                # Short URL redirects
  auth/             # Sign-in, error, forgot-password, reset-password pages
src/components/
  admin/            # Admin UI (includes edit-template-dialog with form field builder)
  providers/        # RBAC, Auth, Theme context providers
  ui/               # Radix UI-based reusable components (includes Textarea, Separator)
src/lib/
  file-system/      # File/folder operation abstractions
  pdf/              # Server-side PDF generation (completion-pdf.tsx uses @react-pdf/renderer)
```

### Key Patterns
- Path alias `@/*` maps to `src/*`
- Tailwind CSS v4 for styling; Radix UI for accessible primitives
- `next.config.mjs` sets `output: 'standalone'` for Docker deployment
- `src/proxy.ts` is the Next.js 16 proxy (formerly middleware) — guards `/documents` and `/scan` routes with auth; named `proxy` not `middleware`
- All activity is logged to Azure Table Storage for auditing

## Environment Variables

Required in `.env.local`:
```env
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER_NAME=documents
NEXTAUTH_SECRET=
NEXTAUTH_URL=
DEFAULT_ADMIN_EMAIL=
AZURE_COMMUNICATION_CONNECTION_STRING=  # provisioned by Terraform via Key Vault
ACS_SENDER_ADDRESS=                     # auto-set by Terraform (DoNotReply@<uuid>.azurecomm.net)
USE_AZURITE=true         # local dev only
DATABASE_URL=            # Neon connection string (or local PostgreSQL for dev)
CRON_SECRET=             # random secret; must also be set as GitHub Actions secret for reminders workflow
```

## Deployment

Docker → GitHub Container Registry (ghcr.io) → Azure App Service.

CI/CD via GitHub Actions (`main` branch → dev, release → prod). Deploy order: lint → security scan → Docker build/push → **`prisma migrate deploy`** → Azure App Service deploy → **smoke test** (`GET /api/health` with 12 retries × 15 s). `DATABASE_URL` must be set as a GitHub environment secret (`dev` and `prod` environments).

Infrastructure is defined with Terraform in `infrastructure/` (see `infrastructure/readme.md` for provisioning steps). `database_url` is a required Terraform variable — stored in Key Vault and injected into App Service via `@Microsoft.KeyVault(...)` reference.

## Code Style

### Formatting (Prettier)
- No semicolons
- Single quotes for JS/TS strings and JSX attributes
- No trailing commas
- LF line endings

### Linting (ESLint)
- `console.log` is disallowed — use `console.warn` or `console.error` only
- Unused variables are errors; prefix intentionally unused parameters with `_`
- React prop-types are off (TypeScript handles this)
- `react-hooks/rules-of-hooks` is an error; `exhaustive-deps` is a warning

**Import ordering** is enforced and must follow this group sequence, with a blank line between each group, alphabetised within each group:
1. Node built-ins
2. External packages
3. Internal (`@/` aliases)
4. Parent (`../`)
5. Sibling (`./`)
6. Index
7. Object imports
8. Type imports

Husky runs pre-commit checks. Run `npm run checks` before committing to catch all issues.

## Documentation Maintenance

After every meaningful change, update these three files to reflect the new state:
- **`README.md`** — user-facing: update the Testing table, commands, or any section affected by the change
- **`CLAUDE.md`** — Claude-facing: update architecture notes, testing coverage, or any guidance that has changed
- **`future-considerations.md`** — update the status of anything completed, and add any new decisions or considerations that emerged

## Business Context

Health and safety document management platform. Primary user: a small H&S consultancy (Simon) serving up to 100 client businesses. Alan is the sole developer. Future potential: market the platform to other H&S companies (SaaS).

Core document model:
- **Templates** — reusable H&S documents maintained by the consultancy; support comprehension questions and versioning
- **Assignments** — templates assigned to specific customers (individual or company-wide); job role filtering; version tracking
- **Completions** — customer signs an assigned document; immutable signed PDF with audit trail

## Testing Strategy

**Stack:** Vitest (unit + integration), Playwright (E2E — not yet written).

**Current coverage:**
- Unit: full coverage of `src/lib/` and `src/lib/file-system/`
- Integration:
  - `health`
  - Admin: user CRUD (`jobRole`, `lineManagerId` PATCH), password reset flows, document API routes, companies/templates/assignments CRUD (company-wide + individual; comprehension questions PATCH; `dueDate`; `targetJobRoles`; notification emails; no-email line manager routing), completions (list + download + status summary with outstanding users and overdue)
  - Customer: assignments (list with `jobRole` filtering, get single, complete with field + answer validation, download), completions (list + PDF download)
  - Cron: reminders (auth, zero sends, send count, 500 error)
  - Kiosk sign-off: `GET /api/signoff/[companyId]`, `POST /api/signoff/[companyId]/[assignmentId]` (worker validation, comprehension check, completion recording)
  - Document version cycle: `POST /api/admin/templates/[id]/publish-version` (auth, 404, success, 500); `templateVersion` on assignment creation; `publishNewTemplateVersion`; `createAssignmentsForNewVersion`; version-aware deduplication in `getAssignmentsForUser`
- E2E: not yet started

**TDD workflow:** define interface types → write tests → implement to pass tests. Always request tests before implementation. Target >90% coverage on `src/lib/`.

**Test discipline (non-negotiable):**
- Update existing tests whenever code changes
- Write new tests whenever new code is added
- Run `npm run checks` before every commit

Add E2E tests (Playwright) once the document model is more stable. Add E2E step to CI after the Playwright suite exists.

## Future Considerations

See `future-considerations.md` for full architectural analysis. Key items still pending:

- **Electronic signing** — server-side PDF (React-PDF) + audit trail done; signature pad (canvas) is next; third-party e-signing only if legally required
- **Multi-tenancy** — schema has `Tenant` model and nullable `tenantId` on `User`; build it when needed
- **Compliance** — GDPR (UK); data retention policy needed; signed documents retained 3–5 years under UK H&S law
