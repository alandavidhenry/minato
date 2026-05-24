-- AddColumn: profilePermissions on Tenant
ALTER TABLE "Tenant" ADD COLUMN "profilePermissions" JSONB;
