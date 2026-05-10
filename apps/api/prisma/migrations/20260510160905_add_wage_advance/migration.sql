-- CreateEnum
CREATE TYPE "WageAdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REPAID', 'REJECTED');

-- CreateTable
CREATE TABLE "WageAdvance" (
    "id" TEXT NOT NULL,
    "labourerId" TEXT NOT NULL,
    "requestedKobo" BIGINT NOT NULL,
    "approvedKobo" BIGINT,
    "status" "WageAdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "repaidKobo" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "fullyRepaidAt" TIMESTAMP(3),

    CONSTRAINT "WageAdvance_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WageAdvance" ADD CONSTRAINT "WageAdvance_labourerId_fkey" FOREIGN KEY ("labourerId") REFERENCES "Labourer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
