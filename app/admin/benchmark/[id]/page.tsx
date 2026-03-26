import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreRingHero } from "@/components/ScoreRingHero";
import type { DimensionDetail } from "@/components/ScoreBreakdown";
import { BenchmarkNotesSection } from "./BenchmarkNotesSection";
import { BenchmarkScoreButton } from "./BenchmarkScoreButton";
import { BenchmarkDeleteButton } from "./BenchmarkDeleteButton";
import { BenchmarkScreenshots } from "./BenchmarkScreenshots";
import { AdminBackLink } from "@/components/admin/AdminBackLink";

function scoreHeadline(score: number): string {
  if (score <= 40) return "Needs work";
  if (score <= 60) return "Room to grow";
  if (score <= 80) return "Looking strong";
  return "Excellent";
}

interface ScreenshotEntry {
  type: string;
  url: string;
  label: string;
}

export default async function AdminBenchmarkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const benchmark = await prisma.benchmark.findUnique({
    where: { id },
    include: { notes: { orderBy: { createdAt: "asc" } } },
  });

  if (!benchmark) notFound();

  const url = benchmark.url.startsWith("http") ? benchmark.url : `https://${benchmark.url}`;
  const scoringDetails = (benchmark.scoringDetails ?? []) as unknown as DimensionDetail[];

  // Build screenshots list: prefer new JSON array, fall back to legacy single screenshotUrl
  const rawScreenshots = benchmark.screenshots as unknown;
  const screenshotList: ScreenshotEntry[] = Array.isArray(rawScreenshots) && rawScreenshots.length > 0
    ? (rawScreenshots as ScreenshotEntry[])
    : benchmark.screenshotUrl
      ? [{ type: "desktop", url: benchmark.screenshotUrl, label: "Desktop" }]
      : [];

  const noteList = benchmark.notes.map((n) => ({
    id: n.id,
    authorName: n.authorName,
    content: n.content,
    category: n.category,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <AdminBackLink href="/admin/benchmarks" label="Benchmarks" />

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold break-all">{benchmark.url}</h1>
            <p className="text-muted-foreground mt-1">Industry: {benchmark.industry}</p>
          </div>
          <div className="flex gap-2">
            <BenchmarkScoreButton benchmarkId={id} scored={benchmark.scored} />
            <BenchmarkDeleteButton benchmarkId={id} />
          </div>
        </div>

        {screenshotList.length > 0 && (
          <BenchmarkScreenshots screenshots={screenshotList} siteUrl={url} />
        )}

        {benchmark.scored && (
          <ScoreRingHero
            score={benchmark.overallScore}
            headline={scoreHeadline(benchmark.overallScore)}
            summary={`${benchmark.industry} benchmark`}
            analysisUrl={benchmark.url}
            subtitle={benchmark.scoredAt
              ? `Scored ${new Date(benchmark.scoredAt).toLocaleString(undefined, { timeZone: "America/New_York" })}`
              : undefined
            }
            details={scoringDetails}
          />
        )}

        {!benchmark.scored && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Not scored yet. Click &quot;Score&quot; to run the scoring pipeline.</p>
            </CardContent>
          </Card>
        )}

        <BenchmarkNotesSection benchmarkId={id} initialNotes={noteList} />
      </div>
    </main>
  );
}
