import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPagination } from "@/components/admin/AdminPagination";

const PAGE_SIZE_OPTIONS = [50, 100];

export default async function AdminListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page ?? 1) || 1);
  const pageSize = Math.min(
    PAGE_SIZE_OPTIONS[1] ?? 100,
    Math.max(PAGE_SIZE_OPTIONS[0] ?? 50, Number(params?.pageSize ?? 50) || 50)
  );
  const skip = (page - 1) * pageSize;

  const [refreshes, total] = await Promise.all([
    prisma.refresh.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        targetWebsite: true,
        urlProfileId: true,
        industryDetected: true,
        overallScore: true,
        createdAt: true,
        quoteRequested: true,
        installRequested: true,
        _count: { select: { internalNotes: true } },
        urlProfile: { select: { id: true, analysisCount: true } },
      },
    }),
    prisma.refresh.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold mb-6">Analyses</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent ({total} total)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">URL</th>
                    <th className="text-left p-3 font-medium">Profile</th>
                    <th className="text-left p-3 font-medium">Industry</th>
                    <th className="text-left p-3 font-medium">Score</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Time</th>
                    <th className="text-left p-3 font-medium">Notes</th>
                    <th className="text-left p-3 font-medium">Quote / Install</th>
                  </tr>
                </thead>
                <tbody>
                  {refreshes.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <Link
                          href={`/admin/analysis/${a.id}`}
                          className="text-primary hover:underline truncate max-w-[200px] block"
                        >
                          {a.targetWebsite || a.url}
                        </Link>
                      </td>
                      <td className="p-3">
                        {a.urlProfile ? (
                          <Link
                            href={`/admin/profile/${a.urlProfile.id}`}
                            className="text-primary hover:underline"
                          >
                            <Badge variant="secondary">
                              {a.urlProfile.analysisCount} runs
                            </Badge>
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {a.industryDetected}
                      </td>
                      <td className="p-3">{a.overallScore}/100</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(a.createdAt).toLocaleDateString(undefined, {
                          timeZone: "America/New_York",
                        })}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(a.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/New_York",
                        })}
                      </td>
                      <td className="p-3">
                        {(a._count?.internalNotes ?? 0) > 0 ? (
                          <Badge variant="secondary">
                            {a._count.internalNotes}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        {a.quoteRequested && (
                          <Badge variant="outline" className="mr-1">
                            Quote
                          </Badge>
                        )}
                        {a.installRequested && (
                          <Badge variant="outline">Install</Badge>
                        )}
                        {!a.quoteRequested && !a.installRequested && "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={total}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              basePath="/admin"
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
