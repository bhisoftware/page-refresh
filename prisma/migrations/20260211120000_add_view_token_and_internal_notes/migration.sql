-- AlterTable: add viewToken (nullable first for existing rows)
ALTER TABLE "Analysis" ADD COLUMN "viewToken" TEXT;

-- Backfill existing rows with unique values
UPDATE "Analysis" SET "viewToken" = gen_random_uuid()::text WHERE "viewToken" IS NULL;

-- Now require and unique
ALTER TABLE "Analysis" ALTER COLUMN "viewToken" SET NOT NULL;
CREATE UNIQUE INDEX "Analysis_viewToken_key" ON "Analysis"("viewToken");

-- CreateTable InternalNote
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalNote_analysisId_idx" ON "InternalNote"("analysisId");

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
