-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "targetWebsite" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "htmlSnapshot" TEXT NOT NULL,
    "cssSnapshot" TEXT NOT NULL,
    "extractedColors" JSONB NOT NULL,
    "extractedFonts" JSONB NOT NULL,
    "extractedImages" JSONB NOT NULL,
    "extractedCopy" JSONB NOT NULL,
    "extractedLogo" TEXT,
    "brandAnalysis" TEXT NOT NULL,
    "industryDetected" TEXT NOT NULL,
    "industryConfidence" DOUBLE PRECISION NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "clarityScore" INTEGER NOT NULL,
    "visualScore" INTEGER NOT NULL,
    "hierarchyScore" INTEGER NOT NULL,
    "trustScore" INTEGER NOT NULL,
    "conversionScore" INTEGER NOT NULL,
    "contentScore" INTEGER NOT NULL,
    "mobileScore" INTEGER NOT NULL,
    "performanceScore" INTEGER NOT NULL,
    "scoringDetails" JSONB NOT NULL,
    "seoAudit" JSONB NOT NULL,
    "layout1Html" TEXT NOT NULL,
    "layout1Css" TEXT NOT NULL,
    "layout1Template" TEXT NOT NULL,
    "layout1CopyRefreshed" TEXT NOT NULL,
    "layout2Html" TEXT NOT NULL,
    "layout2Css" TEXT NOT NULL,
    "layout2Template" TEXT NOT NULL,
    "layout2CopyRefreshed" TEXT NOT NULL,
    "layout3Html" TEXT NOT NULL,
    "layout3Css" TEXT NOT NULL,
    "layout3Template" TEXT NOT NULL,
    "layout3CopyRefreshed" TEXT NOT NULL,
    "selectedLayout" INTEGER,
    "quoteRequested" BOOLEAN NOT NULL DEFAULT false,
    "installRequested" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "hostingPlatform" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processingTime" INTEGER,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Industry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scoringCriteria" JSONB NOT NULL,
    "preferredTemplates" JSONB NOT NULL,
    "exampleWebsites" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "htmlTemplate" TEXT NOT NULL,
    "cssTemplate" TEXT NOT NULL,
    "previewImageUrl" TEXT,
    "category" TEXT NOT NULL,
    "suitableIndustries" JSONB NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION,
    "supportsSquarespace" BOOLEAN NOT NULL DEFAULT true,
    "supportsWordPress" BOOLEAN NOT NULL DEFAULT true,
    "supportsWix" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptLog" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "responseText" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "responseTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringRubric" (
    "id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "scoreRange" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "exampleSites" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringRubric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Analysis_url_idx" ON "Analysis"("url");

-- CreateIndex
CREATE INDEX "Analysis_industryDetected_idx" ON "Analysis"("industryDetected");

-- CreateIndex
CREATE INDEX "Analysis_createdAt_idx" ON "Analysis"("createdAt");

-- CreateIndex
CREATE INDEX "Analysis_quoteRequested_idx" ON "Analysis"("quoteRequested");

-- CreateIndex
CREATE INDEX "Analysis_installRequested_idx" ON "Analysis"("installRequested");

-- CreateIndex
CREATE UNIQUE INDEX "Industry_name_key" ON "Industry"("name");

-- CreateIndex
CREATE INDEX "Industry_name_idx" ON "Industry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Template_name_key" ON "Template"("name");

-- CreateIndex
CREATE INDEX "Template_category_idx" ON "Template"("category");

-- CreateIndex
CREATE INDEX "PromptLog_analysisId_idx" ON "PromptLog"("analysisId");

-- CreateIndex
CREATE INDEX "PromptLog_step_idx" ON "PromptLog"("step");

-- CreateIndex
CREATE INDEX "ScoringRubric_dimension_idx" ON "ScoringRubric"("dimension");

-- CreateIndex
CREATE INDEX "ScoringRubric_scoreRange_idx" ON "ScoringRubric"("scoreRange");

-- AddForeignKey
ALTER TABLE "PromptLog" ADD CONSTRAINT "PromptLog_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
