-- CreateEnum
CREATE TYPE "VideoKind" AS ENUM ('LINK', 'FILE');

-- CreateTable
CREATE TABLE "RestaurantVideo" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "kind" "VideoKind" NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantVideo_restaurantId_idx" ON "RestaurantVideo"("restaurantId");

-- AddForeignKey
ALTER TABLE "RestaurantVideo" ADD CONSTRAINT "RestaurantVideo_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
