-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tableId" TEXT;

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seats" INTEGER,
    "section" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiningTable_restaurantId_idx" ON "DiningTable"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_restaurantId_label_key" ON "DiningTable"("restaurantId", "label");

-- CreateIndex
CREATE INDEX "Order_tableId_idx" ON "Order"("tableId");

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
