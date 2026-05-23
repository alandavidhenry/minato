-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "targetJobRoles" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jobRole" TEXT;
