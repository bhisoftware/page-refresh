-- AlterTable
ALTER TABLE "Refresh" ADD COLUMN     "benchmarkComparison" JSONB,
ADD COLUMN     "layout1Rationale" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "layout2Rationale" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "layout3Rationale" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "skillVersions" JSONB,
ADD COLUMN     "urlProfileId" TEXT;

-- CreateTable
CREATE TABLE "UrlProfile" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "industry" TEXT,
    "industryLocked" BOOLEAN NOT NULL DEFAULT false,
    "brandAssets" JSONB,
    "extractedCopy" JSONB,
    "techStack" JSONB,
    "analysisCount" INTEGER NOT NULL DEFAULT 0,
    "lastAnalyzedAt" TIMESTAMP(3),
    "bestScore" INTEGER,
    "latestScore" INTEGER,
    "customerEmail" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UrlProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrlAsset" (
    "id" TEXT NOT NULL,
    "urlProfileId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT,
    "metadata" JSONB,
    "sourceUrl" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UrlAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSkill" (
    "id" TEXT NOT NULL,
    "agentSlug" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "outputSchema" JSONB,
    "modelOverride" TEXT,
    "maxTokens" INTEGER,
    "temperature" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastEditedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSkillHistory" (
    "id" TEXT NOT NULL,
    "agentSkillId" TEXT NOT NULL,
    "agentSlug" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "editedBy" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSkillHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "configValue" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT,
    "siteName" TEXT,
    "industry" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "clarityScore" INTEGER NOT NULL DEFAULT 0,
    "visualScore" INTEGER NOT NULL DEFAULT 0,
    "hierarchyScore" INTEGER NOT NULL DEFAULT 0,
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "conversionScore" INTEGER NOT NULL DEFAULT 0,
    "contentScore" INTEGER NOT NULL DEFAULT 0,
    "mobileScore" INTEGER NOT NULL DEFAULT 0,
    "performanceScore" INTEGER NOT NULL DEFAULT 0,
    "scoringDetails" JSONB NOT NULL DEFAULT '[]',
    "scored" BOOLEAN NOT NULL DEFAULT false,
    "scoredAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkNote" (
    "id" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UrlProfile_url_key" ON "UrlProfile"("url");

-- CreateIndex
CREATE INDEX "UrlProfile_domain_idx" ON "UrlProfile"("domain");

-- CreateIndex
CREATE INDEX "UrlProfile_industry_idx" ON "UrlProfile"("industry");

-- CreateIndex
CREATE INDEX "UrlProfile_customerEmail_idx" ON "UrlProfile"("customerEmail");

-- CreateIndex
CREATE INDEX "UrlProfile_expiresAt_idx" ON "UrlProfile"("expiresAt");

-- CreateIndex
CREATE INDEX "UrlAsset_urlProfileId_idx" ON "UrlAsset"("urlProfileId");

-- CreateIndex
CREATE INDEX "UrlAsset_urlProfileId_assetType_idx" ON "UrlAsset"("urlProfileId", "assetType");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkill_agentSlug_key" ON "AgentSkill"("agentSlug");

-- CreateIndex
CREATE INDEX "AgentSkill_agentSlug_idx" ON "AgentSkill"("agentSlug");

-- CreateIndex
CREATE INDEX "AgentSkill_category_idx" ON "AgentSkill"("category");

-- CreateIndex
CREATE INDEX "AgentSkillHistory_agentSkillId_idx" ON "AgentSkillHistory"("agentSkillId");

-- CreateIndex
CREATE INDEX "AgentSkillHistory_agentSlug_version_idx" ON "AgentSkillHistory"("agentSlug", "version");

-- CreateIndex
CREATE INDEX "ApiConfig_provider_idx" ON "ApiConfig"("provider");

-- CreateIndex
CREATE INDEX "ApiConfig_provider_configKey_active_idx" ON "ApiConfig"("provider", "configKey", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ApiConfig_provider_configKey_label_key" ON "ApiConfig"("provider", "configKey", "label");

-- CreateIndex
CREATE INDEX "Benchmark_industry_idx" ON "Benchmark"("industry");

-- CreateIndex
CREATE INDEX "Benchmark_industry_scored_idx" ON "Benchmark"("industry", "scored");

-- CreateIndex
CREATE INDEX "Benchmark_industry_active_idx" ON "Benchmark"("industry", "active");

-- CreateIndex
CREATE INDEX "Benchmark_industry_overallScore_idx" ON "Benchmark"("industry", "overallScore");

-- CreateIndex
CREATE INDEX "BenchmarkNote_benchmarkId_idx" ON "BenchmarkNote"("benchmarkId");

-- CreateIndex
CREATE INDEX "Refresh_urlProfileId_idx" ON "Refresh"("urlProfileId");

-- AddForeignKey
ALTER TABLE "Refresh" ADD CONSTRAINT "Refresh_urlProfileId_fkey" FOREIGN KEY ("urlProfileId") REFERENCES "UrlProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrlAsset" ADD CONSTRAINT "UrlAsset_urlProfileId_fkey" FOREIGN KEY ("urlProfileId") REFERENCES "UrlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkillHistory" ADD CONSTRAINT "AgentSkillHistory_agentSkillId_fkey" FOREIGN KEY ("agentSkillId") REFERENCES "AgentSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkNote" ADD CONSTRAINT "BenchmarkNote_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE CASCADE ON UPDATE CASCADE;
