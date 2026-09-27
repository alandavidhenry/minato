-- AlterTable
ALTER TABLE "CompletionRecord" ADD COLUMN     "signerIp" TEXT,
ADD COLUMN     "signerUserAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "employeeNumber" TEXT;
