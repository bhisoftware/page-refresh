import { notFound, forbidden } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutSection } from "@/components/LayoutSection";
import { ScoreBreakdown, type DimensionDetail } from "@/components/ScoreBreakdown";
import { SeoAuditSection, type SeoCheckItem, type SeoRecommendation } from "@/components/SeoAuditSection";
import { InstallCtaCard } from "@/components/InstallCtaCard";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
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
      layout2Html: true,
      layout2Css: true,
      layout2Template: true,
      layout2CopyRefreshed: true,
      layout3Html: true,
      layout3Css: true,
      layout3Template: true,
      layout3CopyRefreshed: true,
      layout4Html: true,
      layout4Css: true,
      layout4Template: true,
      layout4CopyRefreshed: true,
      layout5Html: true,
      layout5Css: true,
      layout5Template: true,
      layout5CopyRefreshed: true,
      layout6Html: true,
      layout6Css: true,
      layout6Template: true,
      layout6CopyRefreshed: true,
      selectedLayout: true,
      quoteRequested: true,
      installRequested: true,
      createdAt: true,
      processingTime: true,
    },
  });
}

function scoreTagline(score: number): string {
  if (score <= 40) return "Your homepage has significant room for improvement.";
  if (score <= 60) return "Your homepage is okay but could be stronger.";
  if (score <= 80) return "Your homepage is in good shape with some room to grow.";
  return "Your homepage is in great shape.";
}

function scoreColorClass(score: number): string {
  if (score <= 40) return "text-destructive";
  if (score <= 60) return "text-amber-600 dark:text-amber-400";
  if (score <= 80) return "text-green-600 dark:text-green-400";
  return "text-blue-600 dark:text-blue-400";
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
  const scoringDetails = (refresh.scoringDetails ?? []) as unknown as DimensionDetail[];
  const layoutRows = [
    {
      layoutIndex: 1 as const,
      templateName: refresh.layout1Template ?? "Layout 1",
      layoutHtml: refresh.layout1Html,
      layoutCss: refresh.layout1Css ?? "",
      layoutCopyRefreshed: refresh.layout1CopyRefreshed ?? refresh.layout1Html,
    },
    {
      layoutIndex: 2 as const,
      templateName: refresh.layout2Template ?? "Layout 2",
      layoutHtml: refresh.layout2Html,
      layoutCss: refresh.layout2Css ?? "",
      layoutCopyRefreshed: refresh.layout2CopyRefreshed ?? refresh.layout2Html,
    },
    {
      layoutIndex: 3 as const,
      templateName: refresh.layout3Template ?? "Layout 3",
      layoutHtml: refresh.layout3Html,
      layoutCss: refresh.layout3Css ?? "",
      layoutCopyRefreshed: refresh.layout3CopyRefreshed ?? refresh.layout3Html,
    },
    {
      layoutIndex: 4 as const,
      templateName: refresh.layout4Template ?? "Layout 4",
      layoutHtml: refresh.layout4Html,
      layoutCss: refresh.layout4Css ?? "",
      layoutCopyRefreshed: refresh.layout4CopyRefreshed ?? refresh.layout4Html,
    },
    {
      layoutIndex: 5 as const,
      templateName: refresh.layout5Template ?? "Layout 5",
      layoutHtml: refresh.layout5Html,
      layoutCss: refresh.layout5Css ?? "",
      layoutCopyRefreshed: refresh.layout5CopyRefreshed ?? refresh.layout5Html,
    },
    {
      layoutIndex: 6 as const,
      templateName: refresh.layout6Template ?? "Layout 6",
      layoutHtml: refresh.layout6Html,
      layoutCss: refresh.layout6Css ?? "",
      layoutCopyRefreshed: refresh.layout6CopyRefreshed ?? refresh.layout6Html,
    },
  ];
  const layoutsWithContent = layoutRows.filter((r) => r.layoutHtml?.trim());
  const hasLayouts = layoutsWithContent.length > 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Overall Score */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">
              Overall score
            </CardTitle>
            {(refresh.url ?? refresh.targetWebsite) && (
              <p className="text-sm text-muted-foreground font-normal mt-1 break-all">
                {refresh.url ?? refresh.targetWebsite}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-5xl font-bold tabular-nums",
                scoreColorClass(overallScore)
              )}
            >
              {overallScore}/100
            </p>
            <p className="mt-2 text-muted-foreground">
              {scoreTagline(overallScore)}
            </p>
          </CardContent>
        </Card>

        {/* Summary message */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-foreground leading-relaxed">
              Your homepage design scores {overallScore}/100. Compared to web
              standards, here are up to 6 homepage refresh directions that
              address the gaps we found:
            </p>
          </CardContent>
        </Card>

        {/* Score breakdown */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Score by dimension</h2>
          <ScoreBreakdown details={scoringDetails} />
        </section>

        {/* SEO Audit */}
        <SeoAuditSection
          checks={((refresh.seoAudit as { checks?: SeoCheckItem[] })?.checks ?? []) as SeoCheckItem[]}
          recommendations={((refresh.seoAudit as { recommendations?: SeoRecommendation[] })?.recommendations ?? []) as SeoRecommendation[]}
        />

        {/* Layout cards */}
        {hasLayouts ? (
          <LayoutSection refreshId={id} viewToken={token!} layouts={layoutsWithContent} />
        ) : (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Choose a layout</h2>
            <p className="text-muted-foreground">
              Layout proposals are not available for this refresh.
            </p>
          </section>
        )}

        {/* Install CTA */}
        <InstallCtaCard refreshId={id} />
      </div>
    </main>
  );
}

