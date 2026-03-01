-- AlterTable
ALTER TABLE "UrlProfile" ADD COLUMN     "cms" TEXT,
ADD COLUMN     "cmsLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "hostingPlatform" TEXT;
