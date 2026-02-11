-- RenameTable: Analysis -> Refresh
ALTER TABLE "Analysis" RENAME TO "Refresh";
ALTER TABLE "Refresh" RENAME CONSTRAINT "Analysis_pkey" TO "Refresh_pkey";

-- RenameColumn: PromptLog.analysisId -> refreshId
ALTER TABLE "PromptLog" RENAME COLUMN "analysisId" TO "refreshId";

-- RenameColumn: InternalNote.analysisId -> refreshId
ALTER TABLE "InternalNote" RENAME COLUMN "analysisId" TO "refreshId";

-- Rename indexes on Refresh (optional for clarity; Prisma may recreate on next migrate)
DROP INDEX IF EXISTS "Analysis_url_idx";
CREATE INDEX "Refresh_url_idx" ON "Refresh"("url");
DROP INDEX IF EXISTS "Analysis_industryDetected_idx";
CREATE INDEX "Refresh_industryDetected_idx" ON "Refresh"("industryDetected");
DROP INDEX IF EXISTS "Analysis_createdAt_idx";
CREATE INDEX "Refresh_createdAt_idx" ON "Refresh"("createdAt");
DROP INDEX IF EXISTS "Analysis_quoteRequested_idx";
CREATE INDEX "Refresh_quoteRequested_idx" ON "Refresh"("quoteRequested");
DROP INDEX IF EXISTS "Analysis_installRequested_idx";
CREATE INDEX "Refresh_installRequested_idx" ON "Refresh"("installRequested");
DROP INDEX IF EXISTS "Analysis_viewToken_key";
CREATE UNIQUE INDEX "Refresh_viewToken_key" ON "Refresh"("viewToken");

-- Rename FK constraints and indexes on PromptLog/InternalNote (column already renamed)
ALTER TABLE "PromptLog" DROP CONSTRAINT IF EXISTS "PromptLog_analysisId_fkey";
ALTER TABLE "PromptLog" ADD CONSTRAINT "PromptLog_refreshId_fkey" FOREIGN KEY ("refreshId") REFERENCES "Refresh"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX IF EXISTS "PromptLog_analysisId_idx";
CREATE INDEX "PromptLog_refreshId_idx" ON "PromptLog"("refreshId");

ALTER TABLE "InternalNote" DROP CONSTRAINT IF EXISTS "InternalNote_analysisId_fkey";
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_refreshId_fkey" FOREIGN KEY ("refreshId") REFERENCES "Refresh"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX IF EXISTS "InternalNote_analysisId_idx";
CREATE INDEX "InternalNote_refreshId_idx" ON "InternalNote"("refreshId");
