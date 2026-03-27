"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import { COMMENT_ANCHORS } from "@/lib/validations";
import { CommentThread } from "./CommentThread";
import { NewCommentForm } from "./NewCommentForm";
import type { ThreadedNote } from "./types";

const ANCHOR_LABELS: Record<string, string> = {
  screenshots: "Screenshots",
  overall: "Overall Score",
  clarity: "Clarity",
  visual: "Visual Quality",
  hierarchy: "Hierarchy",
  trust: "Trust",
  conversion: "Conversion",
  content: "Content",
  mobile: "Mobile",
  performance: "Performance",
};

interface CommentSidebarProps {
  benchmarkId: string;
  threads: ThreadedNote[];
  setThreads: Dispatch<SetStateAction<ThreadedNote[]>>;
  activeAnchor: string | null;
  setActiveAnchor: Dispatch<SetStateAction<string | null>>;
}

export function CommentSidebar({
  benchmarkId,
  threads,
  setThreads,
  activeAnchor,
  setActiveAnchor,
}: CommentSidebarProps) {
  const [showResolved, setShowResolved] = useState(false);

  const resolvedCount = threads.filter((t) => t.resolvedAt !== null).length;
  const visibleThreads = showResolved
    ? threads
    : threads.filter((t) => t.resolvedAt === null);

  const threadsByAnchor = (anchor: string | null) =>
    visibleThreads.filter((t) => t.anchor === anchor);

  const anchorSections = COMMENT_ANCHORS.filter(
    (a) => threadsByAnchor(a).length > 0 || activeAnchor === a,
  );
  const generalThreads = threadsByAnchor(null);
  const hasGeneral = true;

  const totalVisible = visibleThreads.length;

  return (
    <div className="sticky top-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Comments</h3>
        {resolvedCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? "Hide" : "Show"} {resolvedCount} resolved
          </Button>
        )}
      </div>

      {anchorSections.map((anchor) => (
        <div key={anchor}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {ANCHOR_LABELS[anchor] ?? anchor}
            </h4>
            <button
              type="button"
              onClick={() => setActiveAnchor(activeAnchor === anchor ? null : anchor)}
              className="p-0.5 rounded hover:bg-muted transition-colors"
              aria-label={`Add comment to ${anchor}`}
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-2">
            {threadsByAnchor(anchor).map((t) => (
              <CommentThread key={t.id} benchmarkId={benchmarkId} thread={t} setThreads={setThreads} />
            ))}
            {activeAnchor === anchor && (
              <NewCommentForm
                benchmarkId={benchmarkId}
                anchor={anchor}
                setThreads={setThreads}
                onClose={() => setActiveAnchor(null)}
              />
            )}
          </div>
        </div>
      ))}

      {hasGeneral && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">General</h4>
            <button
              type="button"
              onClick={() => setActiveAnchor(activeAnchor === "__general" ? null : "__general")}
              className="p-0.5 rounded hover:bg-muted transition-colors"
              aria-label="Add general comment"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-2">
            {generalThreads.map((t) => (
              <CommentThread key={t.id} benchmarkId={benchmarkId} thread={t} setThreads={setThreads} />
            ))}
            {activeAnchor === "__general" && (
              <NewCommentForm
                benchmarkId={benchmarkId}
                anchor={null}
                setThreads={setThreads}
                onClose={() => setActiveAnchor(null)}
              />
            )}
          </div>
        </div>
      )}

      {totalVisible === 0 && activeAnchor === null && (
        <p className="text-xs text-muted-foreground">
          Hover over a section and click the comment icon to start.
        </p>
      )}
    </div>
  );
}
