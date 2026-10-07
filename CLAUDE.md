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
npm run test:e2e     # Run Playwright E2E tests (needs docker:up + a migrated/seeded DB + the app running)
npm run test:e2e:ui  # Run Playwright tests in UI mode
```

`npm run checks` is the full quality gate — run it before committing. `npm run test:e2e` is not part of `checks` (it needs external services running) — see `README.md`'s "End-to-end tests" section for setup.

## Architecture

Document management platform built on **Next.js 16 App Router** with **Azure** as the backend infrastructure.

Stack summary: Azure Blob Storage (files), Azure Table Storage (`activityLogs` audit trail only), Neon PostgreSQL via Prisma (all relational data; client in `src/generated/prisma/`, singleton `src/lib/prisma.ts`), NextAuth v4 credentials auth (`src/lib/auth.ts`, roles in `src/types/rbac.ts`), Azure Communication Services email (`src/lib/email.ts`), Gotenberg for Word→PDF, Azure AI Foundry for comprehension-question suggestions.

Detail lives in `docs/` — **read the relevant file before working in that area** rather than guessing:
- `docs/data-model.md` — Prisma models, templates/versioning, assignments, completions, reviews, recurring sign-offs, retention, key lib functions
- `docs/architecture.md` — auth, email/reminders, `src/app` and `src/components` structure, UI patterns (app shell, DataTable, breadcrumbs, design tokens)
- `docs/testing.md` — what is covered where, and how
- `future-considerations.md` / `product-roadmap.md` — open work and plan; `adr.md` — past decisions (reference only)

Always-relevant patterns:
- Path alias `@/*` → `src/*`; Tailwind v4 with semantic tokens from `src/app/globals.css` (no hardcoded palette classes); Radix UI primitives
- `src/proxy.ts` is the Next.js 16 proxy (not `middleware`)
- Prisma nullable JSON: use `toJsonValue` from `src/lib/prisma-json.ts`
- All activity is logged to Azure Table Storage for auditing
- **Azurite emulator** — set `USE_AZURITE=true` in `.env.local` for Azure Storage local development; PostgreSQL connects to Neon (or local DB) via `DATABASE_URL`


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
GOTENBERG_URL=            # base URL of the Gotenberg conversion service, e.g. http://localhost:3000 for local dev (docker run --rm -p 3000:3000 gotenberg/gotenberg:8)
GOTENBERG_BASIC_AUTH_USERNAME=  # only set in deployed environments (Terraform-provisioned, public Container App is locked down with basic auth)
GOTENBERG_BASIC_AUTH_PASSWORD=  # only set in deployed environments
AI_FOUNDRY_ENDPOINT=      # Azure AI Foundry account endpoint (Terraform-provisioned, infrastructure/modules/ai_foundry/)
AI_FOUNDRY_KEY=           # Azure AI Foundry account key
AI_FOUNDRY_DEPLOYMENT_NAME=  # model deployment name used for comprehension question generation
AI_FOUNDRY_API_VERSION=   # optional; defaults to 2024-10-21 if unset
```

## Deployment

Docker → GitHub Container Registry (ghcr.io) → Azure App Service.

CI/CD via GitHub Actions (`main` branch → dev, release → prod). Deploy order: lint → security scan → **Playwright E2E** (`.github/workflows/playwright.yml`, called from `pr-check.yml`/`dev-deploy.yml`/`prod-deploy.yml` — spins up Postgres/Azurite/Gotenberg, migrates + seeds a throwaway DB, builds and starts the app, runs `e2e/` against it) → Docker build/push → **`prisma migrate deploy`** → Azure App Service deploy → **smoke test** (`GET /api/health/deep` with 12 retries × 15 s). `DATABASE_URL` must be set as a GitHub environment secret (`dev` and `prod` environments).

**Health checks are split in two** (`src/app/api/health/route.ts` vs `src/app/api/health/deep/route.ts`): `GET /api/health` is a plain liveness check (no DB/storage calls) — it's the path Azure App Service's built-in health monitor (`health_check_path`, `infrastructure/modules/app_service/`) pings continuously (~every 60 s, for the app's whole lifetime), and a real Neon query on every ping would keep the compute endpoint awake around the clock and defeat autosuspend, burning through Neon's free-tier compute-hour quota in days. `GET /api/health/deep` runs the real DB (`SELECT 1`) + Blob Storage (`getProperties`) checks and is used only by the CI/CD smoke test, which needs to verify actual dependency health after a deploy.

Infrastructure is defined with Terraform in `infrastructure/` (see `infrastructure/readme.md` for provisioning steps). `database_url` is a required Terraform variable — stored in Key Vault and injected into App Service via `@Microsoft.KeyVault(...)` reference.

**Postgres backup/scale-up path**: `infrastructure/modules/postgres_flexible_server/` scaffolds an Azure Database for PostgreSQL Flexible Server module — deliberately not referenced by `modules/minato/main.tf`, so it provisions nothing and costs nothing until wired in. No app code change is needed to switch from Neon: `src/lib/prisma.ts` only reads `DATABASE_URL`, and Flexible Server is wire-compatible standard Postgres, so cutover is a module block + a `DATABASE_URL` app-setting swap (see "Optional modules" in `infrastructure/readme.md`).

**Gotenberg** (`infrastructure/modules/gotenberg/`) — an Azure Container App (Consumption plan, scales to zero between conversions) running `gotenberg/gotenberg:8`, used to convert uploaded Word documents to PDF (`src/lib/document-conversion.ts`). Previously ran on Azure Container Instances, which billed for a fixed-size container around the clock; moved to Container Apps because it has its own free monthly grant (vCPU-seconds/GiB-seconds/requests) independent of the App Service Free (F1) tier's shared 60 CPU-minute/day-per-region budget, and only bills for actual conversion time. It is *not* VNet-isolated: the App Service Plan is on the Free (F1) SKU, which doesn't support regional VNet integration, so the Container App is reachable over the public internet (ingress TLS-terminated by the platform) and locked down with Gotenberg's built-in basic auth instead (credentials generated by Terraform, stored in Key Vault, injected as `GOTENBERG_BASIC_AUTH_USERNAME`/`PASSWORD`). Revisit with VNet-scoped ingress if the App Service Plan is ever upgraded to Basic (B1) or above.

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

## Workflow

For new features use the `/feature` skill (types → tests → implementation → `npm run checks` → docs). Keep this file short: put detailed notes in `docs/`, not here.

## Documentation Maintenance

After a meaningful change, update only what it affects:
- **`docs/*.md`** — the matching reference file (schema/lib changes → `data-model.md`; routes/UI patterns → `architecture.md`; new test areas → `testing.md`)
- **`future-considerations.md`** — mark completed items, add new gaps/deferred work
- **`README.md`** — only if user-facing commands, setup or the testing table changed
- **`adr.md`** — only for a real "why X over Y" architectural decision

## Business Context

Health and safety document management platform. Primary user: a small H&S consultancy (Simon) serving up to 100 client businesses. Alan is the sole developer. Future potential: market the platform to other H&S companies (SaaS).

Core document model:
- **Templates** — reusable H&S documents maintained by the consultancy; support comprehension questions and versioning
- **Assignments** — templates assigned to specific customers (individual or company-wide); job role filtering; version tracking
- **Completions** — customer signs an assigned document; immutable signed PDF with audit trail

## Testing Strategy

**Stack:** Vitest (unit + integration), Playwright (E2E, `e2e/`). Coverage by area is in `docs/testing.md`.

**TDD workflow:** define interface types → write tests → implement to pass tests. Always request tests before implementation. Target >90% coverage on `src/lib/`.

**Test discipline (non-negotiable):**
- Update existing tests whenever code changes
- Write new tests whenever new code is added
- Run `npm run checks` before every commit

Add E2E tests (Playwright) once the document model is more stable. Add E2E step to CI after the Playwright suite exists.

## Future Considerations

See `future-considerations.md` for what's still open (gaps, deferred work), and `product-roadmap.md` for the product plan (feature gaps, automations, SaaS prerequisites, subscription tiers). Past architectural/technical decisions and their reasoning are archived in `adr.md` — reference only, no need to consult it unless asked. Key items still pending:

- **Electronic signing** — server-side PDF (React-PDF) + audit trail + canvas signature pad all done; third-party e-signing only if legally required
- **Multi-tenancy** — schema has `Tenant` model and nullable `tenantId` on `User`; build it when needed
- **Compliance** — GDPR (UK); signed documents retained 3–5 years under UK H&S law, enforced by the configurable `Tenant.completionRetentionYears` guard on `DELETE /api/admin/completions/[id]` (see Data Layer above); right-to-erasure/anonymisation still needed

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
