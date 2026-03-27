"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { ThreadedNote } from "./types";

const SCREENSHOT_TYPES = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "full-page", label: "Full Page" },
] as const;

interface NewCommentFormProps {
  benchmarkId: string;
  anchor: string | null;
  setThreads: Dispatch<SetStateAction<ThreadedNote[]>>;
  onClose: () => void;
}

export function NewCommentForm({ benchmarkId, anchor, setThreads, onClose }: NewCommentFormProps) {
  const [authorName, setAuthorName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  const isScreenshots = anchor === "screenshots";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/benchmark/${benchmarkId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          content: content.trim(),
          anchor: anchor ?? undefined,
          category: category || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed");
      }
      const note = await res.json();
      setThreads((prev) => [
        ...prev,
        {
          id: note.id,
          authorName: note.authorName,
          content: note.content,
          anchor: note.anchor ?? null,
          category: note.category ?? null,
          parentId: null,
          resolvedAt: null,
          createdAt: note.createdAt,
          replies: [],
        },
      ]);
      toast.success("Comment added");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        placeholder="Your name"
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        disabled={loading}
        className="text-sm"
      />
      {isScreenshots && (
        <select
          className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={loading}
        >
          <option value="">Screenshot type</option>
          {SCREENSHOT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      )}
      <textarea
        placeholder="Add a comment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading}
        className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm resize-none"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !content.trim() || !authorName.trim()}>
          Comment
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
