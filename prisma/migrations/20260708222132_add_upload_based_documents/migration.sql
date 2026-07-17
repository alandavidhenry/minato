-- AlterTable
ALTER TABLE "CompletionRecord" ADD COLUMN     "submittedBlobPath" TEXT,
ADD COLUMN     "submittedFileName" TEXT,
ADD COLUMN     "submittedOriginalBlobPath" TEXT;

-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "sourceDocBlobPath" TEXT,
ADD COLUMN     "sourceDocFileName" TEXT,
ADD COLUMN     "sourceDocOriginalBlobPath" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'form',
ADD COLUMN     "uploadMode" TEXT;
