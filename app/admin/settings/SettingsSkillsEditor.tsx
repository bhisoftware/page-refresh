"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SkillSummary = {
  agentSlug: string;
  agentName: string;
  category: string;
  active: boolean;
  version: number;
  updatedAt: string;
};

type SkillDetail = SkillSummary & {
  systemPrompt: string;
  outputSchema: object | null;
  modelOverride: string | null;
  maxTokens: number | null;
  temperature: number | null;
};

const PIPELINE_SLUGS = ["screenshot-analysis", "industry-seo", "score"];
const CREATIVE_SLUGS = ["creative-modern", "creative-classy", "creative-unique"];

export function SettingsSkillsEditor({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    systemPrompt: "",
    modelOverride: "",
    maxTokens: "",
    temperature: "",
  });

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/settings/skills")
      .then((r) => r.json())
      .then((data) => setSkills(data.skills ?? []))
      .catch(() => setSkills([]));
  }, [open]);

  useEffect(() => {
    if (!selectedSlug || !open) {
      setDetail(null);
      return;
    }
    fetch(`/api/admin/settings/skills/${encodeURIComponent(selectedSlug)}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        setForm({
          systemPrompt: data.systemPrompt ?? "",
          modelOverride: data.modelOverride ?? "",
          maxTokens: data.maxTokens != null ? String(data.maxTokens) : "",
          temperature: data.temperature != null ? String(data.temperature) : "",
        });
      })
      .catch(() => setDetail(null));
  }, [selectedSlug, open]);

  async function handleSave() {
    if (!selectedSlug) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/skills/${encodeURIComponent(selectedSlug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: form.systemPrompt,
          modelOverride: form.modelOverride || null,
          maxTokens: form.maxTokens ? Number(form.maxTokens) : undefined,
          temperature: form.temperature ? Number(form.temperature) : undefined,
          editedBy: "Admin",
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetail(updated);
        setSkills((prev) =>
          prev.map((s) => (s.agentSlug === selectedSlug ? { ...s, version: updated.version, updatedAt: updated.updatedAt } : s))
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Agent Skills</DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 min-h-0 gap-4">
          <div className="w-56 shrink-0 border-r pr-4 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">Pipeline</p>
            <ul className="space-y-1 mb-4">
              {skills
                .filter((s) => PIPELINE_SLUGS.includes(s.agentSlug))
                .map((s) => (
                  <li key={s.agentSlug}>
                    <button
                      type="button"
                      onClick={() => setSelectedSlug(s.agentSlug)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-sm",
                        selectedSlug === s.agentSlug
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                        !s.active && "opacity-60"
                      )}
                    >
                      {s.agentName}
                    </button>
                  </li>
                ))}
            </ul>
            <p className="text-xs font-medium text-muted-foreground mb-2">Creative</p>
            <ul className="space-y-1">
              {skills
                .filter((s) => CREATIVE_SLUGS.includes(s.agentSlug))
                .map((s) => (
                  <li key={s.agentSlug}>
                    <button
                      type="button"
                      onClick={() => setSelectedSlug(s.agentSlug)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-sm",
                        selectedSlug === s.agentSlug
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                        !s.active && "opacity-60"
                      )}
                    >
                      {s.agentName}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4">
            {detail ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{detail.agentName}</h3>
                    <p className="text-xs text-muted-foreground">
                      Version {detail.version} · Updated {new Date(detail.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Model override</Label>
                  <Input
                    value={form.modelOverride}
                    onChange={(e) => setForm((f) => ({ ...f, modelOverride: e.target.value }))}
                    placeholder="claude-sonnet-4-20250514"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max tokens</Label>
                    <Input
                      type="number"
                      value={form.maxTokens}
                      onChange={(e) => setForm((f) => ({ ...f, maxTokens: e.target.value }))}
                      placeholder="4096"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      step={0.1}
                      min={0}
                      max={1}
                      value={form.temperature}
                      onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))}
                      placeholder="0.1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>System prompt ({form.systemPrompt.length} chars)</Label>
                  <textarea
                    value={form.systemPrompt}
                    onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                    className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                    spellCheck={false}
                  />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Select an agent to edit.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
