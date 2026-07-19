-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "loginFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loginLockedUntil" TIMESTAMP(3);
