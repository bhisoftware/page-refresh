"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ConfigItem = {
  id: string;
  configKey: string;
  value: string;
  label: string | null;
  encrypted: boolean;
  active: boolean;
  updatedAt: string;
};

type ConfigsResponse = { configs: Record<string, ConfigItem[]> };

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

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic — Claude" },
  { id: "openai", name: "OpenAI" },
  { id: "screenshotone", name: "ScreenshotOne" },
] as const;

const PIPELINE_SLUGS = ["screenshot-analysis", "industry-seo", "score"];
const CREATIVE_SLUGS = ["creative-modern", "creative-classy", "creative-unique"];

export default function AdminSettingsPage() {
  const [configs, setConfigs] = useState<ConfigsResponse | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; error?: string; latency?: number }>>({});
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
    fetch("/api/admin/settings/configs")
      .then((r) => r.json())
      .then(setConfigs)
      .catch(() => setConfigs({ configs: {} }));
  }, []);

  useEffect(() => {
    fetch("/api/admin/settings/skills")
      .then((r) => r.json())
      .then((data) => setSkills(data.skills ?? []))
      .catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
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
  }, [selectedSlug]);

  async function handleTest(provider: string) {
    const res = await fetch("/api/admin/settings/configs/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const data = await res.json();
    setTestResult((prev) => ({ ...prev, [provider]: data }));
  }

  const getApiKeyDisplay = (provider: string) => {
    const list = configs?.configs?.[provider];
    const keyConfig = list?.find((c) => c.configKey === "api_key");
    return keyConfig?.value ?? null;
  };
  const getModelDisplay = (provider: string) => {
    const list = configs?.configs?.[provider];
    const modelConfig = list?.find((c) => c.configKey === "default_model");
    return modelConfig?.value ?? "—";
  };
  const hasKey = (provider: string) => !!getApiKeyDisplay(provider);
  const getStatus = (provider: string) => {
    const r = testResult[provider];
    if (!hasKey(provider)) return "gray";
    if (r?.success) return "green";
    return "yellow";
  };

  async function handleSaveSkill() {
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
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold mb-6">API</h1>
        <div className="space-y-4">
          {PROVIDERS.map((provider) => (
            <Card key={provider.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        getStatus(provider.id) === "green"
                          ? "bg-green-500"
                          : getStatus(provider.id) === "yellow"
                            ? "bg-yellow-500"
                            : "bg-muted-foreground/50"
                      }`}
                    />
                    <CardTitle className="text-base">{provider.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(provider.id)}
                    >
                      Test
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">API Key:</span>
                  <span className="font-mono">
                    {getApiKeyDisplay(provider.id) ?? "Not configured (using env)"}
                  </span>
                </div>
                {(provider.id === "anthropic" || provider.id === "openai") && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20">Model:</span>
                    <span className="font-mono">{getModelDisplay(provider.id)}</span>
                  </div>
                )}
                {testResult[provider.id] && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-muted-foreground">Status:</span>
                    {testResult[provider.id].success ? (
                      <Badge variant="default" className="bg-green-600">Connected</Badge>
                    ) : (
                      <span className="text-destructive">
                        {testResult[provider.id].error ?? "Failed"}
                      </span>
                    )}
                    {testResult[provider.id].latency != null && (
                      <span className="text-muted-foreground text-xs">
                        {testResult[provider.id].latency}ms
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          API keys are stored encrypted in the database. Add or update keys via API or a future form.
          Pipeline uses DB config when present, otherwise falls back to environment variables.
        </p>

        <h1 className="text-2xl font-semibold mb-6 mt-10">Agent Skills</h1>
        <div className="flex flex-1 min-h-0 gap-4 border rounded-lg border-border bg-card p-4">
          <div className="w-56 shrink-0 border-r border-border pr-4 overflow-y-auto">
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
          <div className="flex-1 overflow-y-auto space-y-4 min-w-0">
            {detail ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{detail.agentName}</h3>
                    <p className="text-xs text-muted-foreground">
                      Version {detail.version} · Updated {new Date(detail.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="sm" onClick={handleSaveSkill} disabled={saving}>
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
      </div>
    </main>
  );
}
