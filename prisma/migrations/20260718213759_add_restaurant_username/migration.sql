/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `Restaurant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_username_key" ON "Restaurant"("username");
