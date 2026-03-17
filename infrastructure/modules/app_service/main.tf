resource "azurecaf_name" "app_service_plan" {
  name          = var.project
  resource_type = "azurerm_app_service_plan"
  suffixes      = [var.environment]
}

resource "azurecaf_name" "app_service" {
  name          = var.project
  resource_type = "azurerm_app_service"
  suffixes      = [var.environment]
}

resource "azurerm_service_plan" "main" {
  name                = azurecaf_name.app_service_plan.result
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.sku_name
  tags                = var.tags
}

resource "azurerm_linux_web_app" "main" {
  name                = azurecaf_name.app_service.result
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = var.https_only

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      docker_image_name        = var.docker_image.name
      docker_registry_url      = var.docker_image.registry_url
      docker_registry_username = var.docker_image.registry_username
      docker_registry_password = var.docker_image.registry_password
    }
    always_on = contains(["F1", "FREE", "D1"], var.sku_name) ? false : true

    health_check_path                 = var.health_check_path
    health_check_eviction_time_in_min = 10
  }

  logs {
    detailed_error_messages = false
    failed_request_tracing  = false

    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
  }

  app_settings = var.app_settings

  tags = var.tags
}
