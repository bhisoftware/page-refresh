-- CreateTable
CREATE TABLE "ShowcaseItem" (
    "id" TEXT NOT NULL,
    "refreshId" TEXT NOT NULL,
    "layoutIndex" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "beforeUrl" TEXT,
    "afterS3Key" TEXT,
    "afterGeneratedAt" TIMESTAMP(3),
    "siteLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowcaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowcaseItem_active_sortOrder_idx" ON "ShowcaseItem"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "ShowcaseItem_refreshId_idx" ON "ShowcaseItem"("refreshId");

-- AddForeignKey
ALTER TABLE "ShowcaseItem" ADD CONSTRAINT "ShowcaseItem_refreshId_fkey" FOREIGN KEY ("refreshId") REFERENCES "Refresh"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
