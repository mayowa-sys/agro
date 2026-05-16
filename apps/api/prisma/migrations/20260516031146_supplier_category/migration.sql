-- CreateEnum
CREATE TYPE "SupplierCategory" AS ENUM ('FERTILIZER', 'SEEDS', 'AGROCHEMICALS', 'EQUIPMENT', 'FEED');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "category" "SupplierCategory" NOT NULL DEFAULT 'FERTILIZER',
ADD COLUMN     "description" TEXT;
