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
  password_end_date = "2025-12-31T00:00:00Z"
}

default_admin_email = "alandavidhenry@outlook.com"
