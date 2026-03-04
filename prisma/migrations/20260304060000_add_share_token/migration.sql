-- AlterTable
ALTER TABLE "Refresh" ADD COLUMN     "shareExpiry" TIMESTAMP(3),
ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Refresh_shareToken_key" ON "Refresh"("shareToken");
