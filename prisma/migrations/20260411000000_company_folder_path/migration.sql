-- Add folderPath to CustomerCompany
-- Nullable; auto-set when a company is created via the admin API.
ALTER TABLE "CustomerCompany" ADD COLUMN "folderPath" TEXT;
