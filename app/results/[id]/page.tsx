import { notFound, forbidden } from "next/navigation";
import Link from "next/link";
import { LayoutSection } from "@/components/LayoutSection";
import { LayoutSectionErrorBoundary } from "@/components/LayoutSectionErrorBoundary";
import { type DimensionDetail } from "@/components/ScoreBreakdown";
import { SeoAuditSection, type SeoCheckItem, type SeoRecommendation } from "@/components/SeoAuditSection";
import { BenchmarkComparison, type BenchmarkComparisonData } from "@/components/BenchmarkComparison";
import { ScoreRingHero } from "@/components/ScoreRingHero";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { FailedAnalysisRedirect } from "@/components/FailedAnalysisRedirect";
import { prisma } from "@/lib/prisma";

async function getRefresh(id: string) {
  return prisma.refresh.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      errorStep: true,
      viewToken: true,
      shareToken: true,
      shareExpiry: true,
      url: true,
      targetWebsite: true,
      screenshotUrl: true,
      extractedColors: true,
      extractedFonts: true,
      extractedImages: true,
      extractedCopy: true,
      extractedLogo: true,
      brandAnalysis: true,
      industryDetected: true,
      industryConfidence: true,
      overallScore: true,
      clarityScore: true,
      visualScore: true,
      hierarchyScore: true,
      trustScore: true,
      conversionScore: true,
      contentScore: true,
      mobileScore: true,
      performanceScore: true,
      scoringDetails: true,
      seoAudit: true,
      layout1Html: true,
      layout1Css: true,
      layout1Template: true,
      layout1CopyRefreshed: true,
      layout1Rationale: true,
      layout2Html: true,
      layout2Css: true,
      layout2Template: true,
      layout2CopyRefreshed: true,
      layout2Rationale: true,
      layout3Html: true,
      layout3Css: true,
      layout3Template: true,
      layout3CopyRefreshed: true,
      layout3Rationale: true,
      selectedLayout: true,
      quoteRequested: true,
      installRequested: true,
      createdAt: true,
      processingTime: true,
      benchmarkComparison: true,
      stripePaymentStatus: true,
      stripeSessionId: true,
    },
  });
}

const DIMENSION_LABELS: Record<string, string> = {
  clarity: "clarity",
  visual: "visual quality",
  hierarchy: "information hierarchy",
  trust: "trust & credibility",
  conversion: "conversion & actionability",
  content: "content quality",
  mobile: "mobile experience",
  performance: "performance & technical",
};

function scoreHeadline(score: number): string {
  if (score <= 40) return "Needs work";
  if (score <= 60) return "Room to grow";
  if (score <= 80) return "Looking strong";
  return "Excellent";
}

function buildSummaryText(
  score: number,
  details: DimensionDetail[]
): string {
  if (!details.length) {
    if (score <= 40) return "Your homepage has significant room for improvement.";
    if (score <= 60) return "Your homepage is okay but could be stronger.";
    if (score <= 80) return "Your homepage is in good shape with some room to grow.";
    return "Your homepage is in great shape.";
  }
  const sorted = [...details].sort((a, b) => a.score - b.score);
  const lowest = sorted.slice(0, 2).map(
    (d) => DIMENSION_LABELS[d.dimension] ?? d.dimension
  );
  return `Your homepage has a solid foundation but underperforms in ${lowest[0]} and ${lowest[1]}. Our layout alternatives address these gaps directly.`;
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; share?: string; cached?: string; retried?: string }>;
}) {
  const { id } = await params;
  const { token, share, cached, retried } = await searchParams;
  const refresh = await getRefresh(id);

  if (!refresh) notFound();

  const viewTokenValid =
    typeof token === "string" &&
    token.length > 0 &&
    refresh.viewToken === token;

  const shareTokenValid =
    typeof share === "string" &&
    share.length > 0 &&
    refresh.shareToken === share &&
    refresh.shareExpiry != null &&
    new Date(refresh.shareExpiry) > new Date();

  if (!viewTokenValid && !shareTokenValid) forbidden();

  // Share-link visitors don't have the viewToken in the URL, but downstream
  // components (checkout, reach-out) need it for server-side validation.
  const effectiveToken = viewTokenValid ? token! : refresh.viewToken;

  // Detect fetch-phase failure: status stuck at "fetching" or explicitly failed with no scores
  const isFetchFailed =
    (refresh.status === "fetching" || (refresh.status === "failed" && refresh.errorStep === "fetching")) &&
    Number(refresh.overallScore) === 0;

  if (isFetchFailed) {
    // First attempt: auto-redirect to homepage to silently re-run
    if (retried !== "1") {
      return <FailedAnalysisRedirect url={refresh.url} />;
    }
    // Already retried once: show static fallback with manual retry button
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f0eb]">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-xl font-semibold">Analysis could not complete</h1>
          <p className="text-muted-foreground">
            We were unable to analyze this website after multiple attempts.
            This can happen if the site blocks automated access or is temporarily unavailable.
          </p>
          <Link
            href={`/?url=${encodeURIComponent(refresh.url)}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </Link>
        </div>
      </main>
    );
  }

  const overallScore = Number(refresh.overallScore) || 0;
  const rawScoringDetails = refresh.scoringDetails;
  const scoringDetails = Array.isArray(rawScoringDetails)
    ? (rawScoringDetails as unknown as DimensionDetail[])
    : [];
  const layoutRows = [
    {
      layoutIndex: 1 as const,
      templateName: refresh.layout1Template ?? "Layout 1",
      layoutHtml: refresh.layout1Html,
      layoutCss: refresh.layout1Css ?? "",
      layoutCopyRefreshed: refresh.layout1CopyRefreshed ?? refresh.layout1Html,
      rationale: refresh.layout1Rationale ?? undefined,
    },
    {
      layoutIndex: 2 as const,
      templateName: refresh.layout2Template ?? "Layout 2",
      layoutHtml: refresh.layout2Html,
      layoutCss: refresh.layout2Css ?? "",
      layoutCopyRefreshed: refresh.layout2CopyRefreshed ?? refresh.layout2Html,
      rationale: refresh.layout2Rationale ?? undefined,
    },
    {
      layoutIndex: 3 as const,
      templateName: refresh.layout3Template ?? "Layout 3",
      layoutHtml: refresh.layout3Html,
      layoutCss: refresh.layout3Css ?? "",
      layoutCopyRefreshed: refresh.layout3CopyRefreshed ?? refresh.layout3Html,
      rationale: refresh.layout3Rationale ?? undefined,
    },
  ];
  const layoutsWithContent = layoutRows.filter((r) => r.layoutHtml?.trim());
  const hasLayouts = layoutsWithContent.length > 0;

  const summaryText = buildSummaryText(overallScore, scoringDetails);
  const isCached = cached === "1";
  const ranDate = isCached
    ? new Date(refresh.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-[#f5f0eb] overflow-x-hidden">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4 sm:mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              <Logo iconSize={18} className="gap-1.5" />
            </Link>
          </div>
          {ranDate && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
              Analysis Report · {ranDate}
            </span>
          )}
        </div>

        {/* Score Hero Card */}
        <ScoreRingHero
          score={overallScore}
          headline={scoreHeadline(overallScore)}
          summary={summaryText}
          analysisUrl={refresh.targetWebsite || refresh.url}
          benchmarkBadge={
            refresh.benchmarkComparison != null
              ? `Top ${((refresh.benchmarkComparison as { percentile?: number })?.percentile) ?? 50}th percentile in ${refresh.industryDetected ?? "your industry"}`
              : null
          }
          details={scoringDetails}
        />

        {/* Layout cards */}
        {hasLayouts ? (
          <LayoutSectionErrorBoundary>
            <LayoutSection
              refreshId={id}
              viewToken={effectiveToken}
              layouts={layoutsWithContent}
              stripePaymentStatus={refresh.stripePaymentStatus ?? undefined}
              stripeSessionId={refresh.stripeSessionId ?? undefined}
            />
          </LayoutSectionErrorBoundary>
        ) : (
          <section className="mb-10 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-6">
            <h2 className="text-xl font-semibold mb-4">Choose a layout</h2>
            <p className="text-muted-foreground">
              Layout generation was unable to complete for this refresh. Your
              scores, benchmark comparison, and SEO audit above are still
              valid. Try running another refresh, or check that the creative
              agents (AgentSkill records) are seeded and active.
            </p>
          </section>
        )}


        {/* Industry benchmark */}
        {refresh.benchmarkComparison != null && (
          <BenchmarkComparison
            comparison={refresh.benchmarkComparison as unknown as BenchmarkComparisonData}
            userScores={{
              overall: overallScore,
              clarity: Number(refresh.clarityScore) || 0,
              visual: Number(refresh.visualScore) || 0,
              hierarchy: Number(refresh.hierarchyScore) || 0,
              trust: Number(refresh.trustScore) || 0,
              conversion: Number(refresh.conversionScore) || 0,
              content: Number(refresh.contentScore) || 0,
              mobile: Number(refresh.mobileScore) || 0,
              performance: Number(refresh.performanceScore) || 0,
            }}
          />
        )}

        {/* SEO Audit */}
        <SeoAuditSection
          checks={((refresh.seoAudit as { checks?: SeoCheckItem[] })?.checks ?? []) as SeoCheckItem[]}
          recommendations={((refresh.seoAudit as { recommendations?: SeoRecommendation[] })?.recommendations ?? []) as SeoRecommendation[]}
        />

      </div>
    </main>
  );
}

