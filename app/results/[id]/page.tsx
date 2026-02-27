import { notFound, forbidden } from "next/navigation";
import Link from "next/link";
import { LayoutSection } from "@/components/LayoutSection";
import { LayoutSectionErrorBoundary } from "@/components/LayoutSectionErrorBoundary";
import { ScoreBreakdown, type DimensionDetail } from "@/components/ScoreBreakdown";
import { SeoAuditSection, type SeoCheckItem, type SeoRecommendation } from "@/components/SeoAuditSection";
import { BenchmarkComparison, type BenchmarkComparisonData } from "@/components/BenchmarkComparison";
import { InstallCtaCard } from "@/components/InstallCtaCard";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";

async function getRefresh(id: string) {
  return prisma.refresh.findUnique({
    where: { id },
    select: {
      id: true,
      viewToken: true,
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
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const refresh = await getRefresh(id);

  if (!refresh) notFound();
  const tokenValid =
    typeof token === "string" &&
    token.length > 0 &&
    refresh.viewToken === token;
  if (!tokenValid) forbidden();

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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Score Hero Card */}
        <div className="bg-white rounded-2xl shadow-sm p-10 mb-8 flex flex-col sm:flex-row items-center gap-10">
          {/* Score Ring */}
          <div
            className="w-40 h-40 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: `conic-gradient(
                #4F46E5 0deg,
                #06B6D4 ${(overallScore / 100) * 240}deg,
                #F59E0B ${(overallScore / 100) * 360}deg,
                #E2E8F0 ${(overallScore / 100) * 360}deg
              )`,
            }}
          >
            <div className="w-32 h-32 rounded-full bg-white flex flex-col items-center justify-center">
              <span className="text-5xl font-black tracking-tighter leading-none text-slate-900">
                {overallScore}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Overall
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
              {scoreHeadline(overallScore)}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              {summaryText}
            </p>
            {refresh.benchmarkComparison != null && (
              <span className="inline-block bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1.5 text-sm font-semibold">
                Top {((refresh.benchmarkComparison as { percentile?: number })?.percentile) ?? 50}th percentile in {refresh.industryDetected ?? "your industry"}
              </span>
            )}
          </div>
        </div>

        {/* Layout cards */}
        {hasLayouts ? (
          <LayoutSectionErrorBoundary>
            <LayoutSection refreshId={id} viewToken={token!} layouts={layoutsWithContent} />
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

        {/* Score breakdown */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4">Score by dimension</h2>
          <ScoreBreakdown details={scoringDetails} />
        </section>

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

        {/* Install CTA */}
        <InstallCtaCard refreshId={id} />
      </div>
    </main>
  );
}

