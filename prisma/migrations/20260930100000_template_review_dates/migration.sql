-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN "reviewDueAt" TIMESTAMP(3),
ADD COLUMN "reviewOwnerId" TEXT,
ADD COLUMN "lastReviewedAt" TIMESTAMP(3);

-- Existing templates: review due 12 months after they were last changed
UPDATE "DocumentTemplate" SET "reviewDueAt" = "updatedAt" + INTERVAL '12 months';

-- CreateTable
CREATE TABLE "TemplateReview" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "TemplateReview_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TemplateReview" ADD CONSTRAINT "TemplateReview_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
