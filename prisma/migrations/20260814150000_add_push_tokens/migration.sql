-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "deviceId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_subjectKind_subjectId_deviceId_key" ON "PushToken"("subjectKind", "subjectId", "deviceId");

-- CreateIndex
CREATE INDEX "PushToken_subjectKind_subjectId_idx" ON "PushToken"("subjectKind", "subjectId");

-- CreateIndex
CREATE INDEX "PushToken_restaurantId_idx" ON "PushToken"("restaurantId");
