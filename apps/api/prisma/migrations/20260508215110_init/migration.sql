-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FARMER', 'AGGREGATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CropType" AS ENUM ('YAM', 'CASSAVA', 'MAIZE', 'RICE', 'TOMATO', 'COCOA', 'SESAME', 'OTHER');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'PIDGIN', 'HAUSA', 'YORUBA', 'IGBO');

-- CreateEnum
CREATE TYPE "AccountPurpose" AS ENUM ('WORKING', 'BILLS', 'NEXT_SEASON');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('HARVEST_PAYMENT', 'SPLIT_TRANSFER', 'INPUT_DISBURSEMENT', 'INPUT_REPAYMENT', 'FACTORING_ADVANCE', 'FACTORING_REPAYMENT', 'EXTERNAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DeferralStatus" AS ENUM ('PENDING', 'ACTIVE', 'REPAID', 'DEFAULTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FactoringStatus" AS ENUM ('REQUESTED', 'ADVANCED', 'REPAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "BriefChannel" AS ENUM ('SMS', 'IN_APP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "hashedPin" TEXT,
    "role" "Role" NOT NULL DEFAULT 'FARMER',
    "language" "Language" NOT NULL DEFAULT 'EN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farmer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cropType" "CropType" NOT NULL,
    "region" TEXT NOT NULL,
    "zone" TEXT,
    "plantingDate" TIMESTAMP(3),
    "expectedHarvestDate" TIMESTAMP(3),
    "hashedBvn" TEXT,
    "cooperativeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aggregator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "squadAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aggregator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualAccount" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "squadAccountNumber" TEXT NOT NULL,
    "squadCustomerId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "purpose" "AccountPurpose" NOT NULL,
    "cachedBalance" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitRule" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "workingPct" INTEGER NOT NULL DEFAULT 60,
    "billsPct" INTEGER NOT NULL DEFAULT 25,
    "nextSeasonPct" INTEGER NOT NULL DEFAULT 15,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "virtualAccountId" TEXT NOT NULL,
    "squadReference" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'UNKNOWN',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "rawWebhookPayload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelVersion" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL DEFAULT 90,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastEvent" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "expectedDate" TIMESTAMP(3) NOT NULL,
    "expectedAmount" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasonsJson" JSONB NOT NULL,

    CONSTRAINT "ForecastEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashGap" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "gapAmount" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "squadAccountNumber" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputDeferral" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "agroFee" BIGINT NOT NULL,
    "status" "DeferralStatus" NOT NULL DEFAULT 'PENDING',
    "squadMandateId" TEXT,
    "expectedRepayBy" TIMESTAMP(3),
    "disbursedAt" TIMESTAMP(3),
    "repaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InputDeferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoringAdvance" (
    "id" TEXT NOT NULL,
    "aggregatorId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "fee" BIGINT NOT NULL,
    "status" "FactoringStatus" NOT NULL DEFAULT 'REQUESTED',
    "advancedAt" TIMESTAMP(3),
    "expectedRepayBy" TIMESTAMP(3),
    "repaidAt" TIMESTAMP(3),
    "squadAdvanceTransferRef" TEXT,
    "squadRepaymentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactoringAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiberationLog" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "factoringAdvanceId" TEXT NOT NULL,
    "counterfactualLossKobo" BIGINT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiberationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyBrief" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "contentText" TEXT NOT NULL,
    "channel" "BriefChannel" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropPlaybook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cropType" "CropType" NOT NULL,
    "description" TEXT NOT NULL,
    "baselineSeasonality" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CropPlaybook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_userId_key" ON "Farmer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Aggregator_userId_key" ON "Aggregator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_squadAccountNumber_key" ON "VirtualAccount"("squadAccountNumber");

-- CreateIndex
CREATE INDEX "VirtualAccount_farmerId_purpose_idx" ON "VirtualAccount"("farmerId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "SplitRule_farmerId_key" ON "SplitRule"("farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_squadReference_key" ON "Transaction"("squadReference");

-- CreateIndex
CREATE INDEX "Transaction_virtualAccountId_occurredAt_idx" ON "Transaction"("virtualAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "Forecast_farmerId_generatedAt_idx" ON "Forecast"("farmerId", "generatedAt");

-- CreateIndex
CREATE INDEX "ForecastEvent_forecastId_expectedDate_idx" ON "ForecastEvent"("forecastId", "expectedDate");

-- CreateIndex
CREATE UNIQUE INDEX "LiberationLog_factoringAdvanceId_key" ON "LiberationLog"("factoringAdvanceId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyBrief_farmerId_weekOf_channel_key" ON "WeeklyBrief"("farmerId", "weekOf", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CropPlaybook_name_key" ON "CropPlaybook"("name");

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aggregator" ADD CONSTRAINT "Aggregator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitRule" ADD CONSTRAINT "SplitRule_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_virtualAccountId_fkey" FOREIGN KEY ("virtualAccountId") REFERENCES "VirtualAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastEvent" ADD CONSTRAINT "ForecastEvent_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "Forecast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashGap" ADD CONSTRAINT "CashGap_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputDeferral" ADD CONSTRAINT "InputDeferral_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputDeferral" ADD CONSTRAINT "InputDeferral_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoringAdvance" ADD CONSTRAINT "FactoringAdvance_aggregatorId_fkey" FOREIGN KEY ("aggregatorId") REFERENCES "Aggregator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoringAdvance" ADD CONSTRAINT "FactoringAdvance_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiberationLog" ADD CONSTRAINT "LiberationLog_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiberationLog" ADD CONSTRAINT "LiberationLog_factoringAdvanceId_fkey" FOREIGN KEY ("factoringAdvanceId") REFERENCES "FactoringAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyBrief" ADD CONSTRAINT "WeeklyBrief_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
