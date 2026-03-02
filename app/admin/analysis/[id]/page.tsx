import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBreakdown, type DimensionDetail } from "@/components/ScoreBreakdown";
import { ScoreRingHero } from "@/components/ScoreRingHero";
import { InstallCtaCard } from "@/components/InstallCtaCard";
import { AdminLayoutViewer } from "@/components/AdminLayoutViewer";
import type { LayoutItem } from "@/components/LayoutSection";
import { AdminNotesSection } from "./AdminNotesSection";
import { AdminPromptLogs } from "./AdminPromptLogs";
import { ArrowLeft } from "lucide-react";

function scoreHeadline(score: number): string {
  if (score <= 40) return "Needs work";
  if (score <= 60) return "Room to grow";
  if (score <= 80) return "Looking strong";
  return "Excellent";
}

export default async function AdminAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const refresh = await prisma.refresh.findUnique({
    where: { id },
    include: {
      urlProfile: true,
      internalNotes: { orderBy: { createdAt: "asc" } },
      promptHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!refresh) notFound();

  const overallScore = Number(refresh.overallScore) || 0;
  const scoringDetails = (refresh.scoringDetails ?? []) as unknown as DimensionDetail[];
  const resultsUrl = `/results/${id}?token=${encodeURIComponent(refresh.viewToken)}`;
  const profile = refresh.urlProfile;
  const industry = profile?.industry ?? refresh.industryDetected;
  const cms = profile?.cms;
  const contactEmail = refresh.contactEmail || profile?.customerEmail;
  const contactPhone = refresh.contactPhone || profile?.contactPhone;
  const hostingPlatform = refresh.hostingPlatform || profile?.hostingPlatform;

  const layoutRows: LayoutItem[] = [
    {
      layoutIndex: 1 as const,
      templateName: (refresh.layout1Template as string) ?? "Layout 1",
      layoutHtml: refresh.layout1Html as string,
      layoutCss: (refresh.layout1Css as string) ?? "",
      layoutCopyRefreshed: (refresh.layout1CopyRefreshed as string) ?? (refresh.layout1Html as string),
      rationale: (refresh.layout1Rationale as string) || undefined,
    },
    {
      layoutIndex: 2 as const,
      templateName: (refresh.layout2Template as string) ?? "Layout 2",
      layoutHtml: refresh.layout2Html as string,
      layoutCss: (refresh.layout2Css as string) ?? "",
      layoutCopyRefreshed: (refresh.layout2CopyRefreshed as string) ?? (refresh.layout2Html as string),
      rationale: (refresh.layout2Rationale as string) || undefined,
    },
    {
      layoutIndex: 3 as const,
      templateName: (refresh.layout3Template as string) ?? "Layout 3",
      layoutHtml: refresh.layout3Html as string,
      layoutCss: (refresh.layout3Css as string) ?? "",
      layoutCopyRefreshed: (refresh.layout3CopyRefreshed as string) ?? (refresh.layout3Html as string),
      rationale: (refresh.layout3Rationale as string) || undefined,
    },
  ];
  const layoutsWithContent = layoutRows.filter((r) => r.layoutHtml?.trim());
  const hasLayouts = layoutsWithContent.length > 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Refresh
        </Link>

        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold truncate max-w-xl">
            {refresh.targetWebsite || refresh.url}
          </h1>
          <Link
            href={resultsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open results page →
          </Link>
          {profile && (
            <Link
              href={`/admin/profile/${profile.id}`}
              className="text-sm text-primary hover:underline"
            >
              View URL profile →
            </Link>
          )}
        </div>

        {/* Site details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Site details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-muted-foreground block">Industry</span>
                <span>{industry}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">CMS</span>
                <span>{cms || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Analyses</span>
                <span>{profile?.analysisCount ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Best score</span>
                <span>{profile?.bestScore ?? "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact info (internal only) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Contact (internal)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {(contactEmail || contactPhone) ? (
              <ul className="space-y-1">
                {contactEmail && (
                  <li>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    {contactEmail}
                    {!refresh.contactEmail && profile?.customerEmail && (
                      <span className="text-xs text-muted-foreground ml-1">(from profile)</span>
                    )}
                  </li>
                )}
                {contactPhone && (
                  <li>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    {contactPhone}
                    {!refresh.contactPhone && profile?.contactPhone && (
                      <span className="text-xs text-muted-foreground ml-1">(from profile)</span>
                    )}
                  </li>
                )}
                {refresh.quoteRequested && (
                  <li className="text-muted-foreground">Quote requested</li>
                )}
                {refresh.installRequested && (
                  <li className="text-muted-foreground">Install requested</li>
                )}
                {hostingPlatform && (
                  <li>
                    <span className="text-muted-foreground">Platform:</span>{" "}
                    {hostingPlatform}
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-muted-foreground">No contact info submitted.</p>
            )}
          </CardContent>
        </Card>

        {/* Error details (only shown when errors exist) */}
        {refresh.errorMessage && (
          <Card className="mb-6 border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Error Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {refresh.errorStep && (
                <p><span className="text-muted-foreground">Step:</span> {refresh.errorStep}</p>
              )}
              <p><span className="text-muted-foreground">Message:</span> {refresh.errorMessage}</p>
              <p><span className="text-muted-foreground">Status:</span> {refresh.status}</p>
            </CardContent>
          </Card>
        )}

        {/* Overall score */}
        <ScoreRingHero
          score={overallScore}
          headline={scoreHeadline(overallScore)}
          summary={`${refresh.industryDetected} analysis`}
          subtitle={new Date(refresh.createdAt).toLocaleString(undefined, {
            timeZone: "America/New_York",
          })}
        />

        {/* Layout Preview & Export (Admin) */}
        {hasLayouts && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Layout Previews</h2>
            <AdminLayoutViewer
              refreshId={id}
              viewToken={refresh.viewToken}
              layouts={layoutsWithContent}
            />
          </section>
        )}

        {/* Score breakdown */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Score by dimension</h2>
          <ScoreBreakdown details={scoringDetails} />
        </section>

        {/* Install CTA */}
        <InstallCtaCard refreshId={id} />

        {/* Internal notes */}
        <AdminNotesSection
          refreshId={id}
          initialNotes={refresh.internalNotes}
        />

        {/* Prompt logs */}
        <AdminPromptLogs logs={refresh.promptHistory} />
      </div>
    </main>
  );
}
