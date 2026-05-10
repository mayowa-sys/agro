-- CreateEnum
CREATE TYPE "LiberationSource" AS ENUM ('MIDDLEMAN_DISCOUNT_AVOIDED', 'CASH_ON_DAY_PREMIUM_CAPTURED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GigStatus" AS ENUM ('ACCEPTED', 'FARMER_CONFIRMED_DONE', 'LABOURER_CONFIRMED_DONE', 'BOTH_CONFIRMED', 'PAID', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WageTransferStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterEnum
ALTER TYPE "AccountPurpose" ADD VALUE 'LABOUR_SAVINGS';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LABOURER';

-- DropForeignKey
ALTER TABLE "VirtualAccount" DROP CONSTRAINT "VirtualAccount_farmerId_fkey";

-- AlterTable
ALTER TABLE "LiberationLog" ADD COLUMN     "source" "LiberationSource" NOT NULL DEFAULT 'MIDDLEMAN_DISCOUNT_AVOIDED';

-- AlterTable
ALTER TABLE "VirtualAccount" ADD COLUMN     "balanceKobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "farmerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Labourer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "skills" TEXT[],
    "spokenLanguages" TEXT[],
    "reputationTier" INTEGER NOT NULL DEFAULT 1,
    "totalGigsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalEarnedKobo" BIGINT NOT NULL DEFAULT 0,
    "profileEmbedding" TEXT,
    "profileEmbeddingUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Labourer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "skillsRequired" TEXT[],
    "expectedDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "payAmountKobo" BIGINT NOT NULL,
    "workersNeeded" INTEGER NOT NULL DEFAULT 1,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "sourceForecastEventId" TEXT,
    "descriptionEmbedding" TEXT,
    "descriptionEmbeddingUpdatedAt" TIMESTAMP(3),
    "demandConfidence" DOUBLE PRECISION,
    "demandConsistency" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gig" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "labourerId" TEXT NOT NULL,
    "agreedAmountKobo" BIGINT NOT NULL,
    "status" "GigStatus" NOT NULL DEFAULT 'ACCEPTED',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "farmerConfirmedAt" TIMESTAMP(3),
    "labourerConfirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "wageTransferId" TEXT,

    CONSTRAINT "Gig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "farmerScoreOfLabourer" INTEGER,
    "farmerComment" TEXT,
    "labourerScoreOfFarmer" INTEGER,
    "labourerComment" TEXT,
    "labourerId" TEXT NOT NULL,
    "raterLabourerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WageTransfer" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "fromVirtualAccountId" TEXT NOT NULL,
    "toVirtualAccountId" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "squadTransferRef" TEXT,
    "status" "WageTransferStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "succeededAt" TIMESTAMP(3),

    CONSTRAINT "WageTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchFeedback" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "labourerId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "wasAccepted" BOOLEAN NOT NULL,
    "wasCompleted" BOOLEAN,
    "farmerRating" INTEGER,
    "labourerRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MatchFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Labourer_userId_key" ON "Labourer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Gig_wageTransferId_key" ON "Gig"("wageTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_gigId_key" ON "Rating"("gigId");

-- CreateIndex
CREATE UNIQUE INDEX "WageTransfer_gigId_key" ON "WageTransfer"("gigId");

-- CreateIndex
CREATE INDEX "VirtualAccount_userId_purpose_idx" ON "VirtualAccount"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labourer" ADD CONSTRAINT "Labourer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gig" ADD CONSTRAINT "Gig_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gig" ADD CONSTRAINT "Gig_labourerId_fkey" FOREIGN KEY ("labourerId") REFERENCES "Labourer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gig" ADD CONSTRAINT "Gig_wageTransferId_fkey" FOREIGN KEY ("wageTransferId") REFERENCES "WageTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_labourerId_fkey" FOREIGN KEY ("labourerId") REFERENCES "Labourer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_raterLabourerId_fkey" FOREIGN KEY ("raterLabourerId") REFERENCES "Labourer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
