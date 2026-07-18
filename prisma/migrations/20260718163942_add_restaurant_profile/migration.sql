-- CreateEnum
CREATE TYPE "RestaurantFormat" AS ENUM ('FINE_DINING', 'CASUAL_DINING', 'QSR', 'CAFE', 'CLOUD_KITCHEN', 'BAR', 'BAKERY', 'FOOD_TRUCK', 'OTHER');

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "cuisines" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "fssaiExpiry" TIMESTAMP(3),
ADD COLUMN     "fssaiLicense" TEXT,
ADD COLUMN     "googleUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "panNumber" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "restaurantFormat" "RestaurantFormat",
ADD COLUMN     "seatingCapacity" INTEGER,
ADD COLUMN     "serviceDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceDineIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "serviceTakeaway" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "RestaurantImage" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantImage_restaurantId_idx" ON "RestaurantImage"("restaurantId");

-- AddForeignKey
ALTER TABLE "RestaurantImage" ADD CONSTRAINT "RestaurantImage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
