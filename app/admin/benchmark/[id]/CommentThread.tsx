"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Reply, Check, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ThreadedNote } from "./types";

const CATEGORY_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  "full-page": "Full Page",
};

interface CommentThreadProps {
  benchmarkId: string;
  thread: ThreadedNote;
  setThreads: Dispatch<SetStateAction<ThreadedNote[]>>;
}

export function CommentThread({ benchmarkId, thread, setThreads }: CommentThreadProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyAuthor, setReplyAuthor] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(false);

  const isResolved = thread.resolvedAt !== null;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyAuthor.trim() || !replyContent.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/benchmark/${benchmarkId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: replyAuthor.trim(),
          content: replyContent.trim(),
          anchor: thread.anchor ?? undefined,
          parentId: thread.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to reply");
      const reply = await res.json();
      setThreads((prev) =>
        prev.map((t) =>
          t.id === thread.id
            ? {
                ...t,
                replies: [
                  ...t.replies,
                  { id: reply.id, authorName: reply.authorName, content: reply.content, createdAt: reply.createdAt },
                ],
              }
            : t,
        ),
      );
      setReplyContent("");
      setShowReply(false);
      toast.success("Reply added");
    } catch {
      toast.error("Failed to reply");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/benchmark/${benchmarkId}/notes/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !isResolved }),
      });
      if (!res.ok) throw new Error("Failed");
      setThreads((prev) =>
        prev.map((t) =>
          t.id === thread.id
            ? { ...t, resolvedAt: isResolved ? null : new Date().toISOString() }
            : t,
        ),
      );
      toast.success(isResolved ? "Reopened" : "Resolved");
    } catch {
      toast.error("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this thread and all replies?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/benchmark/${benchmarkId}/notes/${thread.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setThreads((prev) => prev.filter((t) => t.id !== thread.id));
      toast.success("Thread deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("rounded-lg border p-3 text-sm", isResolved && "opacity-50")}>
      {/* Root comment */}
      <div className="flex justify-between gap-2">
        <span className="font-medium text-foreground flex items-center gap-1.5">
          {thread.authorName}
          {thread.category && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
              {CATEGORY_LABELS[thread.category] ?? thread.category}
            </Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {new Date(thread.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{thread.content}</p>

      {/* Actions */}
      <div className="mt-2 flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={() => setShowReply(!showReply)}
          disabled={loading}
        >
          <Reply className="h-3 w-3 mr-1" />
          Reply
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={handleResolve}
          disabled={loading}
        >
          {isResolved ? (
            <>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reopen
            </>
          ) : (
            <>
              <Check className="h-3 w-3 mr-1" />
              Resolve
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={loading}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="mt-3 border-l-2 border-muted pl-3 space-y-2">
          {thread.replies.map((r) => (
            <div key={r.id}>
              <div className="flex justify-between gap-2">
                <span className="font-medium text-foreground text-xs">{r.authorName}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap">{r.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {showReply && (
        <form onSubmit={handleReply} className="mt-3 border-l-2 border-muted pl-3 space-y-2">
          <Input
            placeholder="Your name"
            value={replyAuthor}
            onChange={(e) => setReplyAuthor(e.target.value)}
            disabled={loading}
            className="text-sm h-8"
          />
          <textarea
            placeholder="Reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            disabled={loading}
            className="w-full min-h-[40px] rounded-md border bg-background px-3 py-1.5 text-sm resize-none"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={loading || !replyContent.trim() || !replyAuthor.trim()}>
              Reply
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowReply(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
