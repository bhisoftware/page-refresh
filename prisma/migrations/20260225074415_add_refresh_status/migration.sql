-- AlterTable
ALTER TABLE "Refresh" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "Refresh_status_idx" ON "Refresh"("status");
