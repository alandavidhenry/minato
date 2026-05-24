-- Add version to DocumentTemplate (existing rows get version 1)
ALTER TABLE "DocumentTemplate" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Add templateVersion to Assignment (existing rows get templateVersion 1)
ALTER TABLE "Assignment" ADD COLUMN "templateVersion" INTEGER NOT NULL DEFAULT 1;

-- Drop old partial unique indexes (did not include version)
DROP INDEX "Assignment_company_wide_unique";
DROP INDEX "Assignment_user_specific_unique";

-- New partial unique indexes: one assignment per template version per company/user
CREATE UNIQUE INDEX "Assignment_company_wide_unique"
  ON "Assignment"("templateId", "customerCompanyId", "templateVersion")
  WHERE "userId" IS NULL;

CREATE UNIQUE INDEX "Assignment_user_specific_unique"
  ON "Assignment"("templateId", "userId", "templateVersion")
  WHERE "userId" IS NOT NULL;
