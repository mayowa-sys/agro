-- DropForeignKey
ALTER TABLE "LiberationLog" DROP CONSTRAINT "LiberationLog_factoringAdvanceId_fkey";

-- DropIndex
DROP INDEX "LiberationLog_factoringAdvanceId_key";

-- AlterTable
ALTER TABLE "LiberationLog" ADD COLUMN     "gigId" TEXT,
ALTER COLUMN "factoringAdvanceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "LiberationLog" ADD CONSTRAINT "LiberationLog_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
