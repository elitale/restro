-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "placedByStaffId" TEXT,
ALTER COLUMN "placedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "receivedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "createdById" DROP NOT NULL;
