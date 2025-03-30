# Navigate to your infrastructure directory
Set-Location ./infrastructure

# Get Terraform outputs
$storage_connection_string = (terraform output -raw storage_connection_string)
$storage_container_name = (terraform output -raw storage_container_name)
$application_id = (terraform output -raw application_id)
$client_secret = (terraform output -raw client_secret)
$tenant_id = (terraform output -raw tenant_id)
$app_service_url = (terraform output -raw app_service_url)
$nextauth_secret = (terraform output -raw nextauth_secret)
$admin_role_id = (terraform output -raw admin_role_id)
$user_role_id = (terraform output -raw user_role_id)

# Create .env.local content
$envContent = @"
# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=$storage_connection_string
AZURE_STORAGE_CONTAINER_NAME=$storage_container_name

# Azure AD
AZURE_AD_CLIENT_ID=$application_id
AZURE_AD_CLIENT_SECRET=$client_secret
AZURE_AD_TENANT_ID=$tenant_id

# Role IDs (these must match the IDs in your Terraform configuration)
AZURE_AD_ADMIN_ROLE_ID=$admin_role_id
AZURE_AD_USER_ROLE_ID=$user_role_id
NEXT_PUBLIC_AZURE_AD_ADMIN_ROLE_ID=$admin_role_id
NEXT_PUBLIC_AZURE_AD_USER_ROLE_ID=$user_role_id

# Next Auth
NEXTAUTH_SECRET=$nextauth_secret
NEXTAUTH_URL=$app_service_url

# Default admin (will be granted admin privileges regardless of Azure AD role)
DEFAULT_ADMIN_EMAIL=alandavidhenry@outlook.com
"@

# Write to .env.local file
$envContent | Out-File -FilePath "../.env.local" -Encoding utf8

Write-Host ".env.local file generated successfully!"