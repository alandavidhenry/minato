variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "redirect_uris" {
  description = "Redirect URIs for the Azure AD application"
  type        = list(string)
}

variable "password_end_date" {
  description = "The end date of the client secret password"
  type        = string
  default     = "2025-12-31T00:00:00Z"
}
