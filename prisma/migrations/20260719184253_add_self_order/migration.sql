-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('STAFF', 'SELF_ORDER');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'STAFF';

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "selfOrderEnabled" BOOLEAN NOT NULL DEFAULT false;
