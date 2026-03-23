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
- **Azure Table Storage** — two tables: `users` (accounts, password hashes, roles) and `activityLogs` (audit trail); accessed via `@azure/data-tables` (`src/lib/user-database.ts`, `src/lib/activity-logger.ts`)
- **Azurite emulator** — set `USE_AZURITE=true` in `.env.local` for local development

### Authentication
NextAuth.js v4 with Credentials provider. Users authenticate against Azure Table Storage; passwords hashed with bcryptjs. Roles are attached to JWT tokens and exposed via session. `src/lib/auth.ts` is the central config; `src/types/next-auth.ts` extends session types; `src/types/rbac.ts` defines roles and permissions.

### App Structure
```
src/app/
  admin/            # Admin dashboard (users, activity logs, settings)
  api/              # Route handlers — auth, documents, folders, scan, shorturl, health
  documents/        # Main file browser UI
  scan/             # Document scanning
  shared/           # Public shared document views
  s/                # Short URL redirects
  auth/             # Sign-in / error pages
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
- All activity is logged to Azure Table Storage for auditing

## Environment Variables

Required in `.env.local`:
```env
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER_NAME=documents
NEXTAUTH_SECRET=
NEXTAUTH_URL=
DEFAULT_ADMIN_EMAIL=
USE_AZURITE=true   # local dev only
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
