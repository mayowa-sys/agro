-- AlterEnum
ALTER TYPE "DeferralStatus" ADD VALUE 'DISBURSED';

-- AlterTable
ALTER TABLE "LiberationLog" ADD COLUMN     "methodologyNote" TEXT;
