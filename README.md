# Minato

A Health & Safety document management platform built with Next.js 16 App Router, Azure Blob Storage, and Azure Table Storage. Supports file browsing, upload, versioning, sharing, document scanning, and role-based access control.

## How It Works

The platform manages the distribution, acknowledgement, and sign-off of Health & Safety documents. It ensures the right people receive the right documents, confirms they have read and understood them, and provides a full audit trail.

```mermaid
flowchart TD
    A([Client Administrator]) -->|Uploads document| B[Document indexed\nRef · Name · Date · Version]
    B --> C[Administrator adds\n2–3 comprehension questions]
    C --> D[Document assigned to staff\nby job role or individual]
    D --> E{Does employee\nhave email?}
    E -->|Yes| F[Notification sent\nto employee]
    E -->|No| G[Reminder sent to\nline manager instead]
    F --> H[Employee reads document\nand answers questions]
    G --> H
    H -->|Correct answers| I[Employee digitally\nsigns off document]
    H -->|Incorrect answers| H
    I --> J[Sign-offs collated]
    J --> K[Report: completed vs overdue\nReminder notifications sent to overdue]
    B2[Updated document uploaded] -->|New version| B
    K -.->|Document revised| B2
```

### Workflow Steps

**1 — Upload a Document**

The Client Administrator uploads a document (e.g. a Policy Document) in the required format. The system automatically indexes it with a document reference number, name, issue date, and version number.

**2 — Add Comprehension Questions**

The Client Administrator sets 2–3 questions about the document content. Users must answer these correctly before they can sign off, confirming they have read and understood the document.

**3 — Assign to Relevant Staff**

The Client Administrator assigns the document to the relevant employees. Assignment can be based on job role, so that (for example) only Engineers receive engineering-specific documents, avoiding manual selection each time.

**4 — Distribution**

The document is distributed to assigned users. Employees with an email address receive a notification and complete the sign-off via their email login. Employees without an email address can sign off using a name-entry option instead, and reminders are sent to their line manager rather than directly to them.

**5 — Read, Answer, and Sign**

The user reads the document, answers the comprehension questions correctly, and digitally signs it off.

**6 — Tracking and Reporting**

The platform collates all sign-offs and produces a report showing who has completed the sign-off and who is overdue. Automated reminder notifications can be configured to chase outstanding sign-offs.

**7 — Document Updates**

When a document is revised, the Client Administrator uploads the new version. The system repeats from step 1, adding the new version to the index while retaining all previous version records.

### Administrator Responsibilities

The Client Administrator is responsible for:
- Uploading and managing documents
- Maintaining the employee list (name, email if applicable, job role)
- Assigning documents to the correct job roles or individuals
- Configuring reminder notifications

## Tech Stack

- **Framework:** Next.js 16 (App Router, standalone Docker output)
- **Auth:** NextAuth.js v4 with Credentials provider
- **Storage:** Azure Blob Storage (files) + Azure Table Storage (activity logs)
- **Database:** Neon PostgreSQL (users, password resets) via Prisma ORM
- **Email:** Azure Communication Services — managed sending domain, no custom domain required
- **Styling:** Tailwind CSS v4, Radix UI
- **Infrastructure:** Terraform on Azure App Service, deployed via Docker

## Local Development

### Prerequisites

- Node.js 22+
- Azurite (Azure Storage emulator) — choose one:
  - **VS Code extension** (recommended): install [Azurite](https://marketplace.visualstudio.com/items?itemName=Azurite.azurite) from the VS Code marketplace, then use the command palette (`Ctrl+Shift+P` → "Azurite: Start")
  - **npx** (no install): `npx azurite --silent` (run from the project root)
  - **Global npm**: `npm install -g azurite` then `azurite --silent`
  - **Docker**: `docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite`

  Azurite writes `__azurite_db_*.json` state files to wherever it is started — these are gitignored if you run it from the project root.

  Set `AZURE_STORAGE_CONNECTION_STRING` to the Azurite default connection string:
  ```
  DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;
  ```

- Gotenberg (Word→PDF conversion, only needed when working on uploaded-document features): `docker run --rm -p 3000:3000 gotenberg/gotenberg:8`, then set `GOTENBERG_URL=http://localhost:3000`

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
   DATABASE_URL=postgresql://...           # Neon connection string (or local PostgreSQL)
   GOTENBERG_URL=http://localhost:3000     # only needed for uploaded-document (Word→PDF) features
   ```

3. Apply the database schema (run once, and again after schema changes):
   ```bash
   npx prisma migrate dev
   ```

4. Seed the initial admin user:
   ```bash
   node scripts/seed-admin.js <password> "Display Name"
   ```

5. Start Azurite (see Prerequisites above), then run the dev server:
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
| `src/lib/pdf/__tests__/` | Unit | `completion-pdf` (`generateCompletionPDF` renders a buffer covering every field type, including `file` and `section`, and embeds a signature image when `signatureDataUrl` is provided) |
| `src/app/api/__tests__/` | Integration | `health`, admin user CRUD (including `jobRole`, `lineManagerId`, and `customerCompanyName` resolution), user registration (`/api/auth/register`, including auto-enrolment on creation), `forgot-password`, `reset-password`, document routes (`upload`, `download`, `delete`, `move`, `rename`, `share`, `versions`), admin companies/templates (including comprehension questions, required `changeReason` on publish, and upload-based template fields on create/publish-version)/version-history (combined current + past versions, resolved author names)/assignments (including `dueDate`, `targetJobRoles`, `autoEnroll`, assignment notification emails, and no-email line manager routing)/completions (including status summary with outstanding users and overdue)/outstanding completions (admin-only)/company-created templates (read-only, admin-only), admin activity logs, admin dashboard stats + compliance KPIs, admin/customer-admin template document upload (`upload-document` routes — auth, size limit, unsupported-type 400, conversion-failure 500, success), admin template document view (`GET /api/admin/templates/[id]/document` — auth, template-not-found 404, non-upload-template 404, success SAS URL, 500 on SAS failure), customer assignments (including `jobRole` filtering, required-field validation for number/select/file/section form field types, the upload-based document SAS view route, the fill-and-return submission upload route + its enforcement on `/complete`, and required `signatureDataUrl` validation on `/complete` with pass-through to PDF generation)/completions (including comprehension answer validation and PDF download), customer admin completions, customer admin self-serve templates (`GET`/`POST`/`PATCH`/`DELETE` scoped to `ownerCompanyId`, ownership-checked 404s, `publish-version`, upload-based template fields), customer admin assignments (company-wide assignment creation restricted to that company's own templates) and users (job-role lookup for the assign dialog), profile self-service (including `jobRole`-change auto-enrolment), cron reminders (including `lastReminderSentAt` update), kiosk sign-off (`GET` worker lorker validation,comprehension check, and required `signatureDataUrl` validation, including new field type validation), file-field uploads (`upload-file` routes for both the authenticated and kiosk d-type validation, 10MBsize limit, success) |

Unit tests mock the Prisma client and Azure SDKs directly and test `src/lib/` functions in isolation. Integration tests call API route handlers end-to-end, mocking only external services (Prisma client, Azure SDKs, email client, NextAuth session) — the full path through route handler → lib function → mocked infrastructure is exercised.

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
| Merge to `main` | `dev-deploy.yml` | Lint, security scan, build+push, DB migrate, deploy to dev, smoke test |
| Release published in GitHub UI | `prod-deploy.yml` | Build+push, DB migrate, deploy to prod, smoke test |

The smoke test polls `GET /api/health` (up to 12 × 15 s = 3 min) and fails the deployment if the app does not return `{ "status": "ok" }`. The health endpoint checks both the PostgreSQL database and Azure Blob Storage.

To release to production: go to **GitHub → Releases → Draft a new release**, choose a tag (e.g. `v1.2.3`), and publish. The prod deploy triggers automatically.

## Infrastructure

Azure resources are defined with Terraform in `infrastructure/`. See `infrastructure/readme.md` for provisioning steps.

**Terraform version:** 1.15+ required.

Modules:
- `resource_group` — Azure resource group
- `storage` — Blob Storage account and containers
- `key_vault` — Key Vault for secrets
- `app_service` — App Service plan and web app (Docker)
- `document_intelligence` — Azure AI Document Intelligence
- `communication_service` — Azure Communication Services for email
- `gotenberg` — public Azure Container Instance running Gotenberg, converts uploaded Word documents to PDF; locked down with basic auth rather than VNet-isolated, since the App Service Plan is on the Free (F1) SKU (see `future-considerations.md` P19 for the tradeoff)

Environments are configured in `infrastructure/env/Development/` and `infrastructure/env/Production/`.

### Terraform State Backend

Remote state is stored in Azure Blob Storage and accessed using Azure AD authentication (`ARM_USE_AZUREAD=true`) — no storage account keys are used. The CI/CD workflows set this via environment variable; no extra backend config is needed.

### Bootstrap (first-time setup)

Before running the main Terraform environments, provision the state storage account and grant the CI/CD service principal access:

```bash
cd infrastructure/bootstrap/Development   # or Production
terraform init
terraform apply \
  -var="subscription_id=<SUB_ID>" \
  -var="cicd_sp_object_id=<SP_OBJECT_ID>"
```

This creates the resource group, storage account, container, and assigns `Storage Blob Data Contributor` to the SP. Without this role assignment the backend init will fail with a 403 `AuthorizationPermissionMismatch`.

**If the role assignment was created manually** (e.g. via CLI before the bootstrap was updated), import it into state so Terraform tracks it:

```bash
# 1. Find the role assignment resource ID
az role assignment list \
  --scope "/subscriptions/<SUB_ID>/resourceGroups/rg-terraform-state-dev-uks/providers/Microsoft.Storage/storageAccounts/tfstateminatodevuks" \
  --role "Storage Blob Data Contributor" \
  --query "[].id" -o tsv

# 2. Import it
terraform import \
  -var="subscription_id=<SUB_ID>" \
  -var="cicd_sp_object_id=<SP_OBJECT_ID>" \
  azurerm_role_assignment.cicd_sp_state_blob \
  "<role_assignment_resource_id>"
```

## Deployment

Docker images are built and pushed to GitHub Container Registry (`ghcr.io`) by GitHub Actions, then pulled by Azure App Service.

- Dev image tag: `dev-latest`
- Prod image tags: `latest`, `v<version>`, and the commit SHA
