-- AlterTable: make email nullable (no-email workers have no login)
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable: make passwordHash nullable (no-email workers cannot log in)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable: add lineManagerId for email routing of no-email workers
ALTER TABLE "User" ADD COLUMN "lineManagerId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lineManagerId_fkey" FOREIGN KEY ("lineManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
