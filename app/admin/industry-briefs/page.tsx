import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { IndustryBriefEditor } from "./IndustryBriefEditor";

interface IndustryRow {
  industry: string;
  benchmarkCount: number;
  resolvedCommentCount: number;
  brief: string | null;
  briefUpdatedAt: Date | null;
}

export default async function IndustryBriefsPage() {
  // Get industries from benchmarks, grouped with counts
  const benchmarksByIndustry = await prisma.benchmark.groupBy({
    by: ["industry"],
    _count: { id: true },
    orderBy: { industry: "asc" },
  });

  // Get existing briefs
  const briefs = await prisma.industryBrief.findMany();
  const briefMap = new Map(briefs.map((b) => [b.industry, b]));

  // Get resolved comment counts per industry
  const resolvedCounts = await prisma.benchmarkNote.groupBy({
    by: ["benchmarkId"],
    where: { parentId: null, resolvedAt: { not: null } },
    _count: { id: true },
  });

  // Map benchmarkId → industry via a lookup
  const benchmarkIndustries = await prisma.benchmark.findMany({
    where: { id: { in: resolvedCounts.map((r) => r.benchmarkId) } },
    select: { id: true, industry: true },
  });
  const benchmarkIndustryMap = new Map(benchmarkIndustries.map((b) => [b.id, b.industry]));

  const resolvedByIndustry = new Map<string, number>();
  for (const rc of resolvedCounts) {
    const ind = benchmarkIndustryMap.get(rc.benchmarkId);
    if (ind) resolvedByIndustry.set(ind, (resolvedByIndustry.get(ind) ?? 0) + rc._count.id);
  }

  const rows: IndustryRow[] = benchmarksByIndustry.map((g) => {
    const existing = briefMap.get(g.industry);
    return {
      industry: g.industry,
      benchmarkCount: g._count.id,
      resolvedCommentCount: resolvedByIndustry.get(g.industry) ?? 0,
      brief: existing?.brief ?? null,
      briefUpdatedAt: existing?.updatedAt ?? null,
    };
  });

  // Get resolved comments grouped by industry for the editor reference panel
  const resolvedComments = await prisma.benchmarkNote.findMany({
    where: { parentId: null, resolvedAt: { not: null } },
    orderBy: { resolvedAt: "desc" },
    select: {
      id: true,
      content: true,
      authorName: true,
      anchor: true,
      resolvedAt: true,
      benchmark: { select: { url: true, industry: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        select: { content: true, authorName: true },
      },
    },
  });

  // Group comments by industry
  const commentsByIndustry: Record<
    string,
    Array<{
      id: string;
      content: string;
      authorName: string;
      anchor: string | null;
      benchmarkUrl: string;
      replies: Array<{ content: string; authorName: string }>;
    }>
  > = {};
  for (const c of resolvedComments) {
    const ind = c.benchmark.industry;
    if (!commentsByIndustry[ind]) commentsByIndustry[ind] = [];
    commentsByIndustry[ind].push({
      id: c.id,
      content: c.content,
      authorName: c.authorName,
      anchor: c.anchor,
      benchmarkUrl: c.benchmark.url,
      replies: c.replies,
    });
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <AdminBackLink href="/admin/benchmarks" label="Benchmarks" />
        <h1 className="text-2xl font-semibold mb-2">Industry Briefs</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Curated guidelines that agents receive when scoring and generating layouts.
          Distill your benchmark observations into concise briefs per industry.
        </p>

        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.industry}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{row.industry}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {row.benchmarkCount} benchmark{row.benchmarkCount !== 1 ? "s" : ""}
                    </Badge>
                    {row.resolvedCommentCount > 0 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        {row.resolvedCommentCount} resolved comment{row.resolvedCommentCount !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {row.brief ? (
                      <Badge className="bg-green-600">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">No brief</Badge>
                    )}
                  </div>
                </div>
                {row.briefUpdatedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated {new Date(row.briefUpdatedAt).toLocaleDateString()}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <IndustryBriefEditor
                  industry={row.industry}
                  initialBrief={row.brief ?? ""}
                  comments={commentsByIndustry[row.industry] ?? []}
                />
              </CardContent>
            </Card>
          ))}

          {rows.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm">
                  No benchmarks yet. Add competitor URLs on the Benchmarks page first.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
