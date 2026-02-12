import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 30;

export default async function AdminListPage() {
  const [refreshes, total] = await Promise.all([
    prisma.refresh.findMany({
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        targetWebsite: true,
        industryDetected: true,
        overallScore: true,
        createdAt: true,
        quoteRequested: true,
        installRequested: true,
        _count: { select: { internalNotes: true } },
      },
    }),
    prisma.refresh.count(),
  ]);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold mb-6">Refresh</h1>
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
                      <td className="p-3 text-muted-foreground">
                        {a.industryDetected}
                      </td>
                      <td className="p-3">{a.overallScore}/100</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(a.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
