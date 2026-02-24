import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandAssetsPanel } from "@/components/admin/BrandAssetsPanel";

export default async function AdminProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await prisma.urlProfile.findUnique({
    where: { id },
    include: {
      assets: true,
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          viewToken: true,
          overallScore: true,
          processingTime: true,
          createdAt: true,
        },
      },
    },
  });

  if (!profile) notFound();

  const brandAssets = profile.brandAssets as {
    logo?: string | null;
    heroImage?: string | null;
    favicon?: string | null;
    colors?: unknown;
    fonts?: unknown;
  } | null;

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Analyses
          </Link>
        </div>
        <div>
          <h1 className="text-2xl font-semibold break-all">{profile.url}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>Domain: {profile.domain}</span>
            <span>·</span>
            <span>Industry: {profile.industry ?? "—"}</span>
            {profile.industryLocked && (
              <Badge variant="secondary" className="text-xs">Locked</Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <BrandAssetsPanel
            brandAssets={brandAssets}
            assets={profile.assets.map((a) => ({
              assetType: a.assetType,
              storageUrl: a.storageUrl,
              fileName: a.fileName,
              mimeType: a.mimeType,
            }))}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile metadata</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>Analysis count: {profile.analysisCount}</p>
              <p>Best score: {profile.bestScore ?? "—"}</p>
              <p>Latest score: {profile.latestScore ?? "—"}</p>
              <p>Last analyzed: {profile.lastAnalyzedAt ? new Date(profile.lastAnalyzedAt).toLocaleString() : "—"}</p>
              {profile.customerEmail && <p>Customer: {profile.customerEmail}</p>}
              {profile.expiresAt && <p>Expires: {new Date(profile.expiresAt).toLocaleDateString()}</p>}
              <p>Created: {new Date(profile.createdAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Score</th>
                    <th className="text-left p-3 font-medium">Time</th>
                    <th className="text-left p-3 font-medium">View</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.analyses.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3">{a.overallScore}/100</td>
                      <td className="p-3 text-muted-foreground">
                        {a.processingTime != null ? `${a.processingTime}s` : "—"}
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/admin/analysis/${a.id}`}
                          className="text-primary hover:underline"
                        >
                          Analysis
                        </Link>
                        {" · "}
                        <Link
                          href={`/results/${a.id}?token=${encodeURIComponent(a.viewToken)}`}
                          className="text-primary hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Results
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {profile.analyses.length === 0 && (
              <p className="p-4 text-muted-foreground text-sm">No analyses yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
