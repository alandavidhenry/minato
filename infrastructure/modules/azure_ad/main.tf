# Create Azure AD application
resource "azuread_application" "main" {
  display_name     = "${var.project}-${var.environment}"
  sign_in_audience = "AzureADandPersonalMicrosoftAccount"

  api {
    requested_access_token_version = 2
  }

  web {
    redirect_uris = var.redirect_uris
    implicit_grant {
      access_token_issuance_enabled = false
      id_token_issuance_enabled     = true
    }
  }
}

# Create service principal
resource "azuread_service_principal" "main" {
  client_id = azuread_application.main.client_id
}

# Create client secret
resource "azuread_application_password" "main" {
  application_id = azuread_application.main.id
  display_name   = "Terraform Managed Secret"
  end_date       = var.password_end_date
}
