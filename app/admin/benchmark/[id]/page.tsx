import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreRingHero } from "@/components/ScoreRingHero";
import type { DimensionDetail } from "@/components/ScoreBreakdown";
import { BenchmarkScoreButton } from "./BenchmarkScoreButton";
import { BenchmarkDeleteButton } from "./BenchmarkDeleteButton";
import { BenchmarkScreenshots } from "./BenchmarkScreenshots";
import { BenchmarkCommentLayout } from "./BenchmarkCommentLayout";
import { CommentableSection } from "./CommentableSection";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import type { ThreadedNote } from "./types";

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
    include: {
      notes: {
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: { replies: { orderBy: { createdAt: "asc" } } },
      },
    },
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

  // Map notes to threaded format
  const noteThreads: ThreadedNote[] = benchmark.notes.map((n) => ({
    id: n.id,
    authorName: n.authorName,
    content: n.content,
    anchor: n.anchor,
    category: n.category,
    parentId: n.parentId,
    resolvedAt: n.resolvedAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    replies: n.replies.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    })),
  }));

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
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

        <BenchmarkCommentLayout benchmarkId={id} initialThreads={noteThreads}>
          {/* Score ring at top */}
          {benchmark.scored && (
            <CommentableSection
              anchor="overall"
              subAnchors={[
                { value: "overall", label: "Overall Score" },
                { value: "clarity", label: "Clarity" },
                { value: "visual", label: "Visual Quality" },
                { value: "hierarchy", label: "Hierarchy" },
                { value: "trust", label: "Trust" },
                { value: "conversion", label: "Conversion" },
                { value: "content", label: "Content" },
                { value: "mobile", label: "Mobile" },
                { value: "performance", label: "Performance" },
              ]}
            >
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
            </CommentableSection>
          )}

          {/* Screenshots below score ring */}
          {screenshotList.length > 0 && (
            <CommentableSection anchor="screenshots">
              <BenchmarkScreenshots screenshots={screenshotList} />
            </CommentableSection>
          )}

          {!benchmark.scored && (
            <Card className="mb-8">
              <CardContent className="pt-6">
                <p className="text-muted-foreground">Not scored yet. Click &quot;Score&quot; to run the scoring pipeline.</p>
              </CardContent>
            </Card>
          )}
        </BenchmarkCommentLayout>
      </div>
    </main>
  );
}
