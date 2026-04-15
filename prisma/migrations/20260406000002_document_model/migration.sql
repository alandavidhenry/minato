-- CreateTable: CustomerCompany
CREATE TABLE "CustomerCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DocumentTemplate
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "blobPath" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Assignment
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "customerCompanyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompletionRecord
CREATE TABLE "CompletionRecord" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "signedById" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blobPath" TEXT,
    "formData" JSONB,

    CONSTRAINT "CompletionRecord_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add customerCompanyId to User
ALTER TABLE "User" ADD COLUMN "customerCompanyId" TEXT;

-- CreateIndex: unique assignment per company
CREATE UNIQUE INDEX "Assignment_templateId_customerCompanyId_key" ON "Assignment"("templateId", "customerCompanyId");

-- AddForeignKey: CustomerCompany → Tenant
ALTER TABLE "CustomerCompany" ADD CONSTRAINT "CustomerCompany_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: DocumentTemplate → Tenant
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: User → CustomerCompany
ALTER TABLE "User" ADD CONSTRAINT "User_customerCompanyId_fkey" FOREIGN KEY ("customerCompanyId") REFERENCES "CustomerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Assignment → DocumentTemplate
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Assignment → CustomerCompany
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_customerCompanyId_fkey" FOREIGN KEY ("customerCompanyId") REFERENCES "CustomerCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CompletionRecord → Assignment
ALTER TABLE "CompletionRecord" ADD CONSTRAINT "CompletionRecord_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CompletionRecord → User
ALTER TABLE "CompletionRecord" ADD CONSTRAINT "CompletionRecord_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
