"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ResolvedComment {
  id: string;
  content: string;
  authorName: string;
  anchor: string | null;
  benchmarkUrl: string;
  replies: Array<{ content: string; authorName: string }>;
}

interface IndustryBriefEditorProps {
  industry: string;
  initialBrief: string;
  comments: ResolvedComment[];
}

export function IndustryBriefEditor({ industry, initialBrief, comments }: IndustryBriefEditorProps) {
  const [brief, setBrief] = useState(initialBrief);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(initialBrief.length > 0 || comments.length > 0);
  const router = useRouter();
  const isDirty = brief !== initialBrief;

  async function handleSave() {
    if (!brief.trim()) {
      toast.error("Brief cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/industry-briefs/${encodeURIComponent(industry)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      toast.success(`Brief saved for ${industry}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save brief");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/industry-briefs/${encodeURIComponent(industry)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setBrief("");
      toast.success(`Brief removed for ${industry}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete brief");
    } finally {
      setSaving(false);
    }
  }

  if (!expanded) {
    return (
      <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
        {comments.length > 0
          ? `Write brief (${comments.length} resolved comments to review)`
          : "Write brief"}
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor */}
        <div>
          <label className="text-sm font-medium mb-1 block">
            Agent brief
          </label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[160px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Distill your benchmark observations into concise guidelines for agents. Example: 'HVAC competitors in this market underinvest in trust signals. Most use before/after photo grids. Top performers have clear service area maps and prominent phone CTAs.'"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs ${brief.length > 1500 ? "text-amber-600" : "text-muted-foreground"}`}>
              {brief.length} chars {brief.length > 1500 ? "(consider trimming)" : brief.length > 0 ? "" : ""}
            </span>
            <div className="flex gap-2">
              {initialBrief && (
                <Button variant="outline" size="sm" onClick={handleDelete} disabled={saving}>
                  Remove
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving || !isDirty || !brief.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>

        {/* Resolved comments reference */}
        {comments.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">
              Resolved comments ({comments.length})
            </label>
            <div className="border rounded-md p-3 max-h-[300px] overflow-y-auto space-y-3 bg-muted/30">
              {comments.map((c) => (
                <div key={c.id} className="text-xs space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{c.authorName}</span>
                    {c.anchor && (
                      <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{c.anchor}</span>
                    )}
                    <span className="truncate max-w-[150px]">{c.benchmarkUrl}</span>
                  </div>
                  <p className="text-foreground">{c.content}</p>
                  {c.replies.map((r, i) => (
                    <p key={i} className="pl-3 border-l-2 border-muted text-muted-foreground">
                      <span className="font-medium">{r.authorName}:</span> {r.content}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
