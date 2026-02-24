import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDUSTRIES } from "@/lib/seed-data/industries";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { BenchmarkListActions } from "./BenchmarkListActions";

const PAGE_SIZE_OPTIONS = [50, 100];

export default async function AdminBenchmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; industry?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page ?? 1) || 1);
  const pageSize = Math.min(
    PAGE_SIZE_OPTIONS[1] ?? 100,
    Math.max(PAGE_SIZE_OPTIONS[0] ?? 50, Number(params?.pageSize ?? 50) || 50)
  );
  const industryFilter = params?.industry?.trim() || undefined;
  const skip = (page - 1) * pageSize;

  const where = industryFilter ? { industry: industryFilter } : {};
  const [items, total] = await Promise.all([
    prisma.benchmark.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { notes: true } } },
    }),
    prisma.benchmark.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const industryNames = INDUSTRIES.map((i) => i.name);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold mb-6">Benchmarks</h1>
        <BenchmarkListActions industries={industryNames} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Competitor URLs ({total} total)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">URL</th>
                    <th className="text-left p-3 font-medium">Industry</th>
                    <th className="text-left p-3 font-medium">Score</th>
                    <th className="text-left p-3 font-medium">Scored</th>
                    <th className="text-left p-3 font-medium">Notes</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <tr key={b.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <Link
                          href={`/admin/benchmark/${b.id}`}
                          className="text-primary hover:underline truncate max-w-[240px] block"
                        >
                          {b.url}
                        </Link>
                      </td>
                      <td className="p-3 text-muted-foreground">{b.industry}</td>
                      <td className="p-3">{b.scored ? `${b.overallScore}/100` : "—"}</td>
                      <td className="p-3">
                        {b.scored ? (
                          <Badge variant="default" className="bg-green-600">Yes</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {(b._count?.notes ?? 0) > 0 ? (
                          <Badge variant="secondary">{b._count.notes}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length === 0 && (
              <p className="p-4 text-muted-foreground text-sm">No benchmarks yet. Add a URL above.</p>
            )}
            <AdminPagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={total}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              basePath="/admin/benchmarks"
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
