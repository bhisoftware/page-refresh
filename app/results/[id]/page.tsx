import { notFound, forbidden } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutCard } from "@/components/LayoutCard";
import { ScoreBreakdown, type DimensionDetail } from "@/components/ScoreBreakdown";
import { InstallCtaCard } from "@/components/InstallCtaCard";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

async function getAnalysis(id: string) {
  return prisma.analysis.findUnique({
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
  const analysis = await getAnalysis(id);

  if (!analysis) notFound();
  const tokenValid =
    typeof token === "string" &&
    token.length > 0 &&
    analysis.viewToken === token;
  if (!tokenValid) forbidden();

  const overallScore = Number(analysis.overallScore) || 0;
  const scoringDetails = (analysis.scoringDetails ?? []) as unknown as DimensionDetail[];
  const hasLayouts =
    analysis.layout1Html &&
    analysis.layout2Html &&
    analysis.layout3Html;

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
              standards, here are 3 homepage refresh directions that address the
              gaps we found:
            </p>
          </CardContent>
        </Card>

        {/* Score breakdown */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Score by dimension</h2>
          <ScoreBreakdown details={scoringDetails} />
        </section>

        {/* Layout cards */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Choose a layout</h2>
          {hasLayouts ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <LayoutCard
                layoutIndex={1}
                templateName={analysis.layout1Template ?? "Layout 1"}
                layoutHtml={analysis.layout1Html}
                layoutCss={analysis.layout1Css ?? ""}
                layoutCopyRefreshed={analysis.layout1CopyRefreshed ?? analysis.layout1Html}
                analysisId={id}
              />
              <LayoutCard
                layoutIndex={2}
                templateName={analysis.layout2Template ?? "Layout 2"}
                layoutHtml={analysis.layout2Html}
                layoutCss={analysis.layout2Css ?? ""}
                layoutCopyRefreshed={analysis.layout2CopyRefreshed ?? analysis.layout2Html}
                analysisId={id}
              />
              <LayoutCard
                layoutIndex={3}
                templateName={analysis.layout3Template ?? "Layout 3"}
                layoutHtml={analysis.layout3Html}
                layoutCss={analysis.layout3Css ?? ""}
                layoutCopyRefreshed={analysis.layout3CopyRefreshed ?? analysis.layout3Html}
                analysisId={id}
              />
            </div>
          ) : (
            <p className="text-muted-foreground">
              Layout proposals are not available for this analysis.
            </p>
          )}
        </section>

        {/* Install CTA */}
        <InstallCtaCard analysisId={id} />
      </div>
    </main>
  );
}

