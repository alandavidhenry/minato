# Document Portal

A document management portal built with Next.js 16 App Router, Azure Blob Storage, and Azure Table Storage. Supports file browsing, upload, versioning, sharing, document scanning, and role-based access control.

## Tech Stack

- **Framework:** Next.js 16 (App Router, standalone Docker output)
- **Auth:** NextAuth.js v4 with Credentials provider
- **Storage:** Azure Blob Storage (files) + Azure Table Storage (users, activity logs, password resets)
- **Email:** Azure Communication Services — managed sending domain, no custom domain required
- **Styling:** Tailwind CSS v4, Radix UI
- **Infrastructure:** Terraform on Azure App Service, deployed via Docker

## Local Development

### Prerequisites

- Node.js 22+
- [Azurite](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite) (Azure Storage emulator)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local`:
   ```env
   AZURE_STORAGE_CONNECTION_STRING=
   AZURE_STORAGE_CONTAINER_NAME=documents
   NEXTAUTH_SECRET=any-random-string-for-local-dev
   NEXTAUTH_URL=http://localhost:3000
   DEFAULT_ADMIN_EMAIL=your@email.com
   AZURE_COMMUNICATION_CONNECTION_STRING=  # from Azure portal (ACS resource → Keys)
   ACS_SENDER_ADDRESS=                     # e.g. DoNotReply@<uuid>.azurecomm.net
   USE_AZURITE=true
   ```

3. Start Azurite, then run the dev server:
   ```bash
   npm run dev
   ```

### Available Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run checks       # Lint + format check + TypeScript + tests (full quality gate)
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Testing

Tests are written with [Vitest](https://vitest.dev/) and live alongside the code they test.

### Structure

| Location | Type | What's covered |
|---|---|---|
| `src/lib/__tests__/` | Unit | `user-database`, `password-reset`, `activity-logger`, `storage`, `url-shortener`, `version-manager`, `list-blobs`, `utils` |
| `src/lib/file-system/__tests__/` | Unit | `file-operations`, `folder-operations`, `format-utils`, `path-utils` |
| `src/app/api/__tests__/` | Integration | `health`, admin user CRUD, `forgot-password`, `reset-password`, document routes (`upload`, `download`, `delete`, `move`, `rename`, `share`, `versions`) |

Unit tests mock the Azure SDKs directly and test `src/lib/` functions in isolation. Integration tests call API route handlers end-to-end, mocking only external services (Azure SDKs, email client, NextAuth session) — the full path through route handler → lib function → mocked infrastructure is exercised.

**Test discipline:** Update tests whenever code changes. Add new tests whenever new code is added. Run `npm run checks` before every commit.

### Running tests

```bash
npm test                  # Run all tests once
npm run test:watch        # Re-run on file changes
npm run test:coverage     # Generate coverage report (output in coverage/)
```

All tests run in CI on every PR and release — no Azure credentials or running services are needed.

## Email (Password Reset)

Transactional email is handled by [Azure Communication Services (Email)](https://azure.microsoft.com/en-us/products/communication-services). An Azure-managed sending domain (`DoNotReply@<uuid>.azurecomm.net`) is provisioned automatically by Terraform — no custom domain ownership or DNS setup required. Free tier: 100 emails/day.

The ACS resources are defined in `infrastructure/modules/communication_service/`. Running `terraform apply` provisions everything and injects the connection string and sender address into the App Service via Key Vault.

## CI/CD

| Trigger | Workflow | What happens |
|---|---|---|
| PR opened/updated → `main` | `pr-check.yml` | Lint, security scan, Docker build (no push) |
| Merge to `main` | `dev-deploy.yml` | Lint, security scan, build+push, deploy to dev |
| Release published in GitHub UI | `prod-deploy.yml` | Build+push, deploy to prod |

To release to production: go to **GitHub → Releases → Draft a new release**, choose a tag (e.g. `v1.2.3`), and publish. The prod deploy triggers automatically.

## Infrastructure

Azure resources are defined with Terraform in `infrastructure/`. See `infrastructure/readme.md` for provisioning steps.

Modules:
- `resource_group` — Azure resource group
- `storage` — Blob Storage account and containers
- `key_vault` — Key Vault for secrets
- `app_service` — App Service plan and web app (Docker)
- `document_intelligence` — Azure AI Document Intelligence
- `communication_service` — Azure Communication Services for email

Environments are configured in `infrastructure/env/dev/` and `infrastructure/env/prod/`.

## Deployment

Docker images are built and pushed to GitHub Container Registry (`ghcr.io`) by GitHub Actions, then pulled by Azure App Service.

- Dev image tag: `dev-latest`
- Prod image tags: `latest`, `v<version>`, and the commit SHA
