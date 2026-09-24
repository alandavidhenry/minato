The Terraform error shows the identity running terraform plan (object id 7b1732f1-3e33-40b4-b134-0321b61a8444) no longer has Key Vault data-plane access — role assignment kv_deployer is being replaced because the caller's principal changed (old 427be442-d33e-4e3d-b823-c8034ce9bc20 → new 7b1732f1-...), and Terraform can't finish the read-then-replace in one pass since the new identity isn't authorized yet.

This is likely because you're running as a different user/service principal than when this was last applied (e.g., a different Azure CLI login, or the deployer's object ID rotated).

To confirm and fix:

  Searched for 1 pattern, ran 3 shell commands

The blocker: azurerm_role_assignment.kv_deployer (infrastructure/modules/minato/main.tf:70-74) grants Key Vault access to data.azurerm_client_config.current.object_id — i.e. whatever identity Terraform authenticates as. That identity changed from your user (427be442-..., the old assignment) to the service principal sp-terraform-minato (7b1732f1-...), which is now running the plan (presumably via CI/OIDC). Since principal_id changed, Terraform wants to d create a new one for the SP — but it can't even finish