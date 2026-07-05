-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "ownerCompanyId" TEXT;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_ownerCompanyId_fkey" FOREIGN KEY ("ownerCompanyId") REFERENCES "CustomerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
