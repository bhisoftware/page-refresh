import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BenchmarkNotesSection } from "./BenchmarkNotesSection";
import { BenchmarkScoreButton } from "./BenchmarkScoreButton";
import { BenchmarkDeleteButton } from "./BenchmarkDeleteButton";
import { cn } from "@/lib/utils";

function scoreColorClass(score: number): string {
  if (score <= 40) return "text-destructive";
  if (score <= 60) return "text-amber-600 dark:text-amber-400";
  if (score <= 80) return "text-green-600 dark:text-green-400";
  return "text-blue-600 dark:text-blue-400";
}

const DIMENSION_KEYS = ["clarity", "visual", "hierarchy", "trust", "conversion", "content", "mobile", "performance"] as const;

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
        <Link
          href="/admin/benchmarks"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          ← Benchmarks
        </Link>

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

        {benchmark.scored && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base">Scores</CardTitle>
              {benchmark.scoredAt && (
                <p className="text-sm text-muted-foreground">
                  Last scored: {new Date(benchmark.scoredAt).toLocaleString()}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className={cn("text-3xl font-bold", scoreColorClass(benchmark.overallScore))}>
                Overall: {benchmark.overallScore}/100
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {DIMENSION_KEYS.map((dim) => {
                  const key = `${dim}Score` as keyof typeof benchmark;
                  const score = benchmark[key] as number;
                  return (
                    <div key={dim} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">{dim}</span>
                      <span>{score}/100</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
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
