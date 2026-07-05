-- CreateTable
CREATE TABLE "TemplateVersionHistory" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changeReason" TEXT,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,

    CONSTRAINT "TemplateVersionHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TemplateVersionHistory" ADD CONSTRAINT "TemplateVersionHistory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
