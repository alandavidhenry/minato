# Document Portal Infrastructure

This repository contains the Terraform code for deploying the Document Portal infrastructure to Azure. The infrastructure is organized into reusable modules and environment-specific configurations.

## Directory Structure

```
infrastructure/
├── modules/              # Shared modules
│   ├── resource_group/   # Resource Group module
│   ├── key_vault/        # Key Vault module
│   ├── storage/          # Storage Account module
│   ├── app_service/      # App Service module
│   ├── azure_ad/         # Azure AD module
│   └── document_portal/  # Composition module that uses all the above
├── environments/         # Environment-specific configurations
│   ├── dev/              # Development environment
│   └── prod/             # Production environment
└── bootstrap/            # For state management setup
```

## Getting Started

### Prerequisites

- [Terraform](https://www.terraform.io/downloads.html) (v1.11.0 or newer)
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) (logged in)
- [GitHub Personal Access Token](https://github.com/settings/tokens) with package read permissions

### Bootstrap

Before you can deploy to any environment, you need to set up the Terraform state storage:

```bash
cd infrastructure/bootstrap
terraform init
terraform apply
```

Note the outputs from this command, as you'll need them for the backend configuration.

### Development Environment

To deploy to the development environment:

```bash
cd infrastructure/environments/dev

# Initialize Terraform with the backend config
terraform init -backend-config=backend.conf

# Set the GitHub token (NEVER commit this to version control)
export TF_VAR_github_token="your_github_token"

# Apply the configuration
terraform apply
```

### Production Environment

To deploy to the production environment:

```bash
cd infrastructure/environments/prod

# Initialize Terraform with the backend config
terraform init -backend-config=backend.conf

# Set the GitHub token (NEVER commit this to version control)
export TF_VAR_github_token="your_github_token"

# Apply the configuration using the prod-specific variables
terraform apply -var-file=prod.tfvars
```

## Modules

### Resource Group Module

Creates an Azure Resource Group.

### Key Vault Module

Creates an Azure Key Vault and manages secrets and access policies.

### Storage Module

Creates an Azure Storage Account with containers and CORS rules.

### App Service Module

Creates an Azure App Service Plan and App Service for hosting the application.

### Azure AD Module

Creates an Azure AD Application, Service Principal, and Client Secret for authentication.

### Document Portal Module

A composition module that combines all the above modules to create the complete infrastructure for the Document Portal application.

## Environment Configuration

Each environment (dev, prod) has its own:

- **main.tf** - Main Terraform configuration
- **variables.tf** - Variable definitions
- **terraform.tfvars / prod.tfvars** - Environment-specific variable values
- **backend.conf** - Terraform state backend configuration
- **outputs.tf** - Output definitions

## Best Practices

- Never commit sensitive information (like GitHub tokens) to version control
- Use the backend configuration to keep state separate for each environment
- Use modules for reusable components of your infrastructure
- Document any changes to the infrastructure
