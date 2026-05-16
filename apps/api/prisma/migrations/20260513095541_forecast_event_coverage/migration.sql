-- AlterTable
ALTER TABLE "ForecastEvent" ADD COLUMN     "coveredByCreditId" TEXT,
ADD COLUMN     "coveredKobo" BIGINT;

-- CreateIndex
CREATE INDEX "ForecastEvent_coveredByCreditId_idx" ON "ForecastEvent"("coveredByCreditId");
