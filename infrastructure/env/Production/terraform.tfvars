project              = "minato"
environment          = "prod"
location             = "UK South"
app_service_location = "UK West"
github_username      = "alandavidhenry"

app_service_sku = "F1"
https_only      = true

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

default_admin_email = "alandavidhenry@outlook.com"

extra_app_settings = {
  "WEBSITES_PORT"                       = "8080"
  "WEBSITE_NODE_DEFAULT_VERSION"        = "~24"
  "SCM_DO_BUILD_DURING_DEPLOYMENT"      = "true"
  "WEBSITES_ENABLE_APP_SERVICE_STORAGE" = "true"
  "WEBSITES_CONTAINER_START_TIME_LIMIT" = "600"
}
