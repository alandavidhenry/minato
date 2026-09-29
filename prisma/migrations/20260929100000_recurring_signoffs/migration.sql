-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN "recurrenceMonths" INTEGER,
ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CompletionRecord" ADD COLUMN "validUntil" TIMESTAMP(3);

-- Partial unique indexes now include cycle: one assignment per template version
-- per renewal cycle per company/user
DROP INDEX "Assignment_company_wide_unique";
DROP INDEX "Assignment_user_specific_unique";

CREATE UNIQUE INDEX "Assignment_company_wide_unique"
  ON "Assignment"("templateId", "customerCompanyId", "templateVersion", "cycle")
  WHERE "userId" IS NULL;

CREATE UNIQUE INDEX "Assignment_user_specific_unique"
  ON "Assignment"("templateId", "userId", "templateVersion", "cycle")
  WHERE "userId" IS NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "renewalLeadDays" INTEGER NOT NULL DEFAULT 30;
