"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { InternalNote } from "@prisma/client";

const CATEGORIES = ["review", "sales", "quality", "follow-up"] as const;

interface AdminNotesSectionProps {
  refreshId: string;
  initialNotes: InternalNote[];
}

export function AdminNotesSection({
  refreshId,
  initialNotes,
}: AdminNotesSectionProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [authorName, setAuthorName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analysis/${refreshId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          content: content.trim(),
          category: category.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to add note");
      }
      const note = await res.json();
      setNotes((prev) => [...prev, note]);
      setAuthorName("");
      setContent("");
      setCategory("");
      toast.success("Note added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (note: InternalNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/analysis/${refreshId}/notes/${editingId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent.trim() }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update");
      }
      const updated = await res.json();
      setNotes((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      );
      setEditingId(null);
      setEditContent("");
      toast.success("Note updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("Delete this note?")) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/analysis/${refreshId}/notes/${noteId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-base">Internal notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
          <Input
            placeholder="Your name"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="w-32"
            disabled={loading}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={loading}
          >
            <option value="">Category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Input
            placeholder="Note content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 min-w-[180px]"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !content.trim()}>
            Add note
          </Button>
        </form>

        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="border rounded-lg p-3 bg-muted/20 text-sm"
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm"
                    disabled={loading}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={loading}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelEdit}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-2 flex-wrap">
                    <span className="font-medium text-muted-foreground">
                      {note.authorName}
                      {note.category && (
                        <span className="ml-2 text-xs">({note.category})</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(note.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{note.content}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => startEdit(note)}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => handleDelete(note.id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {notes.length === 0 && (
          <p className="text-muted-foreground text-sm">No notes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
