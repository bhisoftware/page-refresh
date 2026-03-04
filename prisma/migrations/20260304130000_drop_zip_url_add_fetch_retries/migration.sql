-- AlterTable: drop unused zipDownloadUrl, add fetch retry tracking
ALTER TABLE "Refresh" DROP COLUMN IF EXISTS "zipDownloadUrl";
ALTER TABLE "UrlProfile" ADD COLUMN "lastFetchRetries" INTEGER NOT NULL DEFAULT 0;
