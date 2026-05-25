project         = "document-portal-next-azure"
environment     = "dev"
location        = "UK South"
github_username = "alandavidhenry"

app_service_sku = "F1"
https_only      = false

redirect_uris = [
  "http://localhost:3000/api/auth/callback/azure-ad"
]

key_vault = {
  sku_name = "standard"
}

storage = {
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
}

storage_container = {
  name                  = "documents"
  container_access_type = "private"
}

document_intelligence = {
  sku_name = "F0"
}

azure_ad = {
  password_end_date = "2027-12-31T00:00:00Z"
}

default_admin_email = "alandavidhenry@outlook.com"

extra_app_settings = {
  "ACS_SENDER_ADDRESS"                    = "DoNotReply@4c89e1d4-57df-4b07-99d5-35cba3d2f957.azurecomm.net"
  "AZURE_COMMUNICATION_CONNECTION_STRING" = "@Microsoft.KeyVault(SecretUri=https://kv-document-portal-dev.vault.azure.net/secrets/acs-connection-string)"
  "AZURE_STORAGE_CONNECTION_STRING"       = "@Microsoft.KeyVault(SecretUri=https://kv-document-portal-dev.vault.azure.net/secrets/storage-connection-string)"
  "AZURE_STORAGE_CONTAINER_NAME"          = "documents"
  "AZURE_STORAGE_PROXY_HOST"              = "ststdocumentportaldevdev.blob.core.windows.net"
  "DATABASE_URL"                          = "@Microsoft.KeyVault(SecretUri=https://kv-document-portal-dev.vault.azure.net/secrets/database-url)"
  "DOCKER_REGISTRY_SERVER_PASSWORD"       = "@Microsoft.KeyVault(SecretUri=https://kv-document-portal-dev.vault.azure.net/secrets/docker-registry-server-password)"
  "DOCKER_REGISTRY_SERVER_URL"            = "https://ghcr.io"
  "DOCKER_REGISTRY_SERVER_USERNAME"       = "@Microsoft.KeyVault(SecretUri=https://kv-document-portal-dev.vault.azure.net/secrets/docker-registry-server-username)"
  "DOCUMENT_INTELLIGENCE_ENDPOINT"        = "@Microsoft.KeyVault(SecretUri=https://kv-document-portal-dev.vault.azure.net/secrets/document-intelligence-endpoint)"
  "DOCUMENT_INTELLIGENCE_KEY"             = "@Microsoft.KeyVault(SecretUri=https://kv-document-portal-dev.vault.azure.net/secrets/document-intelligence-key)"
  "NEXTAUTH_SECRET"                       = "@Microsoft.KeyVault(SecretUri=https://kv-document-portal-dev.vault.azure.net/secrets/nextauth-secret)"
  "NEXTAUTH_URL"                          = "https://app-document-portal-next-azure-dev.azurewebsites.net"
  "SCM_DO_BUILD_DURING_DEPLOYMENT"        = "true"
  "WEBSITE_HEALTHCHECK_MAXPINGFAILURES"   = "10"
  "WEBSITE_HTTPLOGGING_RETENTION_DAYS"    = "7"
  "WEBSITE_NODE_DEFAULT_VERSION"          = "~24"
  "WEBSITES_CONTAINER_START_TIME_LIMIT"   = "600"
  "WEBSITES_ENABLE_APP_SERVICE_STORAGE"   = "true"
  "WEBSITES_PORT"                         = "8080"
}
