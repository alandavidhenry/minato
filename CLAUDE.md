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
npm run checks       # Run lint + format check + TypeScript type check (no tests exist)
```

No test suite is configured — `npm run checks` is the full quality gate.

## Architecture

Document management portal built on **Next.js 16 App Router** with **Azure** as the backend infrastructure.

### Data Layer (no SQL database)
- **Azure Blob Storage** — file storage, organized in hierarchical paths with versioning via naming convention; SAS tokens for secure temporary access (`src/lib/storage.ts`, `src/lib/file-system/`)
- **Azure Table Storage** — three tables: `users` (accounts, password hashes, roles), `activityLogs` (audit trail), and `passwordResets` (short-lived reset tokens, auto-created on first use); accessed via `@azure/data-tables` (`src/lib/user-database.ts`, `src/lib/activity-logger.ts`, `src/lib/password-reset.ts`)
- **Azurite emulator** — set `USE_AZURITE=true` in `.env.local` for local development

### Authentication
NextAuth.js v4 with Credentials provider. Users authenticate against Azure Table Storage; passwords hashed with bcryptjs. Roles are attached to JWT tokens and exposed via session. `src/lib/auth.ts` is the central config; `src/types/next-auth.ts` extends session types; `src/types/rbac.ts` defines roles and permissions.

Password reset tokens are stored in a third Azure Table Storage table (`passwordResets`) and expire after 1 hour. See `src/lib/password-reset.ts`.

### Email
Transactional email (password reset) is sent via **Azure Communication Services (Email)** (`@azure/communication-email`). An Azure-managed sending domain (`DoNotReply@<uuid>.azurecomm.net`) is provisioned by Terraform — no custom domain or DNS setup required. Free tier: 100 emails/day. ACS is provisioned as part of the IaC (`infrastructure/modules/communication_service/`).

### App Structure
```
src/app/
  admin/            # Admin dashboard (users, activity logs, settings)
  api/              # Route handlers — auth, documents, folders, scan, shorturl, health
  documents/        # Main file browser UI
  scan/             # Document scanning
  shared/           # Public shared document views
  s/                # Short URL redirects
  auth/             # Sign-in, error, forgot-password, reset-password pages
src/components/
  admin/            # Admin UI
  providers/        # RBAC, Auth, Theme context providers
  ui/               # Radix UI-based reusable components
src/lib/
  file-system/      # File/folder operation abstractions
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
```

## Deployment

Docker → GitHub Container Registry (ghcr.io) → Azure App Service.

CI/CD via GitHub Actions (`main` branch → prod, `dev` branch → dev). The `main-deploy.yml` workflow orchestrates: lint → security scan → Docker build/push → Azure deploy → release.

Infrastructure is defined with Terraform in `infrastructure/` (see `infrastructure/readme.md` for provisioning steps).

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

## Business Context

Health and safety document management platform. Primary user: a small H&S consultancy (Simon) serving up to 100 client businesses. Alan is the sole developer. Future potential: market the platform to other H&S companies (SaaS).

Core document model (target state — not yet implemented):
- **Templates** — reusable H&S documents maintained by the consultancy
- **Assignments** — templates assigned to specific customers (many-to-many, some customised per customer)
- **Completions** — customer signs an assigned document; becomes an immutable signed PDF with audit trail

## Testing Strategy

No tests exist yet. Target stack:
- **Vitest** — unit and integration tests (`src/lib/` functions first, then API routes)
- **Playwright** — E2E tests for critical user journeys

**TDD workflow:** define interface types → write tests → implement to pass tests. Always request tests before implementation. Target >90% coverage on `src/lib/`.

Add test steps to CI pipeline: unit/integration tests before Docker build, E2E after build.

## Future Considerations

See `future-considerations.md` for full architectural analysis. Key decisions pending:

- **Database migration** — Azure Table Storage must be replaced with PostgreSQL (Neon free tier recommended) before the document assignment/completion model is built. Prisma as ORM. Design schema with `tenantId` columns from the start for future multi-tenancy.
- **Document model** — templates → assignments → completions. Relational. Cannot be cleanly built on Table Storage.
- **Role model** — needs Platform Admin, Tenant Admin, Tenant Staff, Customer Admin, Customer User. Not yet designed.
- **Electronic signing** — start with server-side PDF generation (React-PDF) + audit trail. Signature pad (canvas) as next step. Third-party e-signing only if legally required.
- **Multi-tenancy** — design schema for it now, build it later.
- **Compliance** — GDPR (UK), data retention policy needed, signed documents retained 3-5 years under UK H&S law.
