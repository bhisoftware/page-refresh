-- AlterTable
ALTER TABLE "Refresh" ADD COLUMN     "badgeHitCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "badgeLastSeenAt" TIMESTAMP(3),
ADD COLUMN     "targetPlatform" TEXT,
ADD COLUMN     "zipDownloadUrl" TEXT,
ADD COLUMN     "zipGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "zipS3Key" TEXT;

-- CreateTable
CREATE TABLE "DeliveryPlatform" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sectionSplit" BOOLEAN NOT NULL DEFAULT false,
    "readmeTemplate" TEXT NOT NULL,
    "platformNotes" TEXT NOT NULL,
    "folderStructure" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPlatform_key_key" ON "DeliveryPlatform"("key");

-- CreateIndex
CREATE INDEX "DeliveryPlatform_enabled_sortOrder_idx" ON "DeliveryPlatform"("enabled", "sortOrder");
