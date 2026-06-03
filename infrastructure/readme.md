# Minato Infrastructure

Terraform code for the Minato Azure infrastructure. Organised into reusable modules and environment-specific configurations.

## Directory Structure

```
infrastructure/
├── bootstrap/            # One-time state backend setup
├── env/
│   ├── dev/              # Development environment
│   └── prod/             # Production environment
└── modules/
    ├── resource_group/
    ├── key_vault/
    ├── storage/
    ├── app_service/
    ├── document_intelligence/
    ├── communication_service/
    └── minato/  # Composition module — orchestrates all others
```

## First-time provisioning (new Azure account)

### Prerequisites

- [Terraform](https://www.terraform.io/downloads.html) ≥ 1.11
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) — logged in to the target account
- GitHub PAT with `read:packages` scope (for GHCR image pulls)
- Neon PostgreSQL connection string

### 1 — Bootstrap (Terraform state backend)

Run once to create the Azure Storage account that holds all Terraform state:

```powershell
cd infrastructure/bootstrap
terraform init
terraform apply
```

Note the `storage_account_name` output (e.g. `tfstateminatodev`).

### 2 — Update the backend storage account name

Edit `env/dev/main.tf` and `env/prod/main.tf` — replace the `storage_account_name` value in the `backend "azurerm"` block with the output from step 1.

### 3 — Create secrets files

```powershell
# Run in both env/dev and env/prod
Copy-Item secrets.auto.tfvars.example secrets.auto.tfvars
```

Fill in each `secrets.auto.tfvars`:

```hcl
subscription_id = "YOUR_AZURE_SUBSCRIPTION_ID"
github_token    = "YOUR_GITHUB_PAT"        # read:packages scope
database_url    = "YOUR_NEON_POSTGRES_URL"
```

These files are `.gitignore`d — never commit them.

### 4 — Provision dev

```powershell
cd infrastructure/env/dev
terraform init
terraform apply
```

Save the outputs for the GitHub Actions setup (step 6):

```powershell
terraform output resource_group_name
terraform output app_service_name
terraform output -raw cron_secret
```

### 5 — Provision prod

```powershell
cd infrastructure/env/prod
terraform init
terraform apply
terraform output -raw cron_secret
```

### 6 — Create a service principal for GitHub Actions

```powershell
az ad sp create-for-rbac `
  --name "sp-terraform" `
  --role Contributor `
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID `
  --sdk-auth
```

Save the entire JSON output — this becomes the `AZURE_CREDENTIALS` GitHub Actions secret.

### 7 — Configure GitHub Actions environments

In **GitHub → repo → Settings → Environments**, configure `Development` and `Production`:

**Secrets:**

| Secret | Value |
|--------|-------|
| `AZURE_CREDENTIALS` | SP JSON from step 6 |
| `DATABASE_URL` | Neon connection string |
| `CRON_SECRET` | `terraform output -raw cron_secret` (per environment) |

**Variables:**

| Variable | Value |
|----------|-------|
| `AZURE_APP_NAME` | `terraform output app_service_name` |
| `AZURE_RESOURCE_GROUP` | `terraform output resource_group_name` |
| `NEXTAUTH_URL` | `https://<AZURE_APP_NAME>.azurewebsites.net` (prod; used by reminders cron) |

### 8 — Deploy

Push to the `dev` branch (or trigger manually via GitHub Actions). The pipeline:
1. Builds and pushes the Docker image to GHCR
2. Runs `prisma migrate deploy` against Neon
3. Sets the container image on App Service
4. Smoke-tests `GET /api/health` (12 retries × 15 s)

---

## Routine apply (after infrastructure changes)

```powershell
cd infrastructure/env/dev   # or env/prod
terraform plan              # review changes
terraform apply
```

---

## What Terraform manages

| Resource | Notes |
|----------|-------|
| Resource Group | Per environment |
| Key Vault | Stores all secrets; app service has Get/List access via managed identity |
| Storage Account | Blob container `documents`; Table `activityLogs` (audit trail) |
| App Service Plan + App | Linux, Docker, system-assigned managed identity |
| Document Intelligence | Free tier (F0); 500 pages/month |
| Azure Communication Services | Email via managed Azure domain; 100 emails/day free |

## What Terraform does NOT manage

- Docker image tags — updated by GitHub Actions on every deploy
- Neon PostgreSQL database schema — managed by `prisma migrate deploy` in the CI pipeline
- GitHub Actions secrets — set manually (they contain values that only exist after `terraform apply`)
