-- Add userId column to Assignment (null = company-wide, set = individual user)
ALTER TABLE "Assignment" ADD COLUMN "userId" TEXT;

-- FK: Assignment.userId → User.id (SET NULL on delete so removing a user doesn't cascade-delete their assignments)
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the old single company-level unique index
DROP INDEX "Assignment_templateId_customerCompanyId_key";

-- Partial unique: at most one company-wide assignment per template per company
CREATE UNIQUE INDEX "Assignment_company_wide_unique"
  ON "Assignment"("templateId", "customerCompanyId") WHERE "userId" IS NULL;

-- Partial unique: at most one individual assignment per template per user
CREATE UNIQUE INDEX "Assignment_user_specific_unique"
  ON "Assignment"("templateId", "userId") WHERE "userId" IS NOT NULL;
