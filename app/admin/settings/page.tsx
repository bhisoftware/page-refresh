"use client";

import { useCallback, useEffect, useState } from "react";
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

const ANTHROPIC_MODELS = [
  {
    group: "Haiku",
    models: [{ value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" }],
  },
  {
    group: "Sonnet",
    models: [{ value: "claude-sonnet-4-6", label: "Sonnet 4.6 — Recommended" }],
  },
  {
    group: "Opus",
    models: [{ value: "claude-opus-4-6", label: "Opus 4.6" }],
  },
];

const ALL_MODEL_VALUES = ANTHROPIC_MODELS.flatMap((g) => g.models.map((m) => m.value));

type HistoryEntry = {
  id: string;
  version: number;
  editedBy: string | null;
  changeNote: string | null;
  systemPrompt: string;
  createdAt: string;
};

type DeliveryPlatformItem = {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  sectionSplit: boolean;
  readmeTemplate: string;
  platformNotes: string;
  folderStructure: string;
};

export default function AdminSettingsPage() {
  const [configs, setConfigs] = useState<ConfigsResponse | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; error?: string; latency?: number }>>({});
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [form, setForm] = useState({
    systemPrompt: "",
    modelOverride: "",
    maxTokens: "",
    temperature: "",
  });

  // Delivery platforms
  const [platforms, setPlatforms] = useState<DeliveryPlatformItem[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);
  const [platformForm, setPlatformForm] = useState({
    label: "",
    enabled: true,
    sectionSplit: false,
    platformNotes: "",
    readmeTemplate: "",
    folderStructure: "",
  });
  const [platformSaving, setPlatformSaving] = useState(false);

  // General settings
  const [cooldownDays, setCooldownDays] = useState("");
  const [cooldownSaving, setCooldownSaving] = useState(false);
  const [cooldownSaved, setCooldownSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings/app")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setCooldownDays(data.analysis_cooldown_days ?? "30");
      })
      .catch(() => setCooldownDays("30"));
  }, []);

  async function handleSaveCooldown() {
    setCooldownSaving(true);
    setCooldownSaved(false);
    try {
      const res = await fetch("/api/admin/settings/app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "analysis_cooldown_days", value: cooldownDays }),
      });
      if (res.ok) {
        setCooldownSaved(true);
        setTimeout(() => setCooldownSaved(false), 2000);
      }
    } finally {
      setCooldownSaving(false);
    }
  }

  // Fetch delivery platforms
  const fetchPlatforms = useCallback(() => {
    fetch("/api/admin/delivery-platforms")
      .then((r) => r.json())
      .then((data) => setPlatforms(data.platforms ?? []))
      .catch(() => setPlatforms([]));
  }, []);

  useEffect(() => { fetchPlatforms(); }, [fetchPlatforms]);

  useEffect(() => {
    if (!selectedPlatformId) return;
    const p = platforms.find((pl) => pl.id === selectedPlatformId);
    if (p) {
      setPlatformForm({
        label: p.label,
        enabled: p.enabled,
        sectionSplit: p.sectionSplit,
        platformNotes: p.platformNotes,
        readmeTemplate: p.readmeTemplate,
        folderStructure: p.folderStructure,
      });
    }
  }, [selectedPlatformId, platforms]);

  async function handleTogglePlatform(id: string, currentEnabled: boolean) {
    const res = await fetch(`/api/admin/delivery-platforms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !currentEnabled }),
    });
    if (res.ok) {
      setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !currentEnabled } : p)));
    }
  }

  async function handleSavePlatform() {
    if (!selectedPlatformId) return;
    setPlatformSaving(true);
    try {
      const res = await fetch(`/api/admin/delivery-platforms/${selectedPlatformId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(platformForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlatforms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } finally {
      setPlatformSaving(false);
    }
  }

  async function handleDeletePlatform(id: string) {
    if (!confirm("Delete this delivery platform? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/delivery-platforms/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPlatforms((prev) => prev.filter((p) => p.id !== id));
      if (selectedPlatformId === id) setSelectedPlatformId(null);
    }
  }

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
      setHistory([]);
      setShowHistory(false);
      return;
    }
    fetch(`/api/admin/settings/skills/${encodeURIComponent(selectedSlug)}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        const mo = data.modelOverride ?? "";
        setForm({
          systemPrompt: data.systemPrompt ?? "",
          modelOverride: mo,
          maxTokens: data.maxTokens != null ? String(data.maxTokens) : "",
          temperature: data.temperature != null ? String(data.temperature) : "",
        });
        setChangeNote("");
      })
      .catch(() => setDetail(null));
    fetch(`/api/admin/settings/skills/${encodeURIComponent(selectedSlug)}/history`)
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]));
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
          changeNote: changeNote || undefined,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetail(updated);
        setChangeNote("");
        setSkills((prev) =>
          prev.map((s) => (s.agentSlug === selectedSlug ? { ...s, version: updated.version, updatedAt: updated.updatedAt } : s))
        );
        // Refresh history
        fetch(`/api/admin/settings/skills/${encodeURIComponent(selectedSlug)}/history`)
          .then((r) => r.json())
          .then((data) => setHistory(data.history ?? []))
          .catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(slug: string, currentActive: boolean) {
    const action = currentActive ? "disable" : "enable";
    if (!confirm(`Are you sure you want to ${action} this agent? ${currentActive ? "It will be skipped during pipeline runs." : "It will be included in pipeline runs."}`)) return;
    const res = await fetch(`/api/admin/settings/skills/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !currentActive, editedBy: "Admin", changeNote: `${currentActive ? "Disabled" : "Enabled"} agent` }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSkills((prev) => prev.map((s) => (s.agentSlug === slug ? { ...s, active: updated.active, version: updated.version, updatedAt: updated.updatedAt } : s)));
      if (detail?.agentSlug === slug) setDetail({ ...detail, active: updated.active, version: updated.version, updatedAt: updated.updatedAt });
    }
  }

  async function handleRollback(version: number) {
    if (!selectedSlug) return;
    if (!confirm(`Restore version ${version}? This creates a new version with the old settings.`)) return;
    setRollingBack(true);
    try {
      const res = await fetch(`/api/admin/settings/skills/${encodeURIComponent(selectedSlug)}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetail(updated);
        const mo = updated.modelOverride ?? "";
        setForm({
          systemPrompt: updated.systemPrompt ?? "",
          modelOverride: mo,
          maxTokens: updated.maxTokens != null ? String(updated.maxTokens) : "",
          temperature: updated.temperature != null ? String(updated.temperature) : "",
        });
        setSkills((prev) => prev.map((s) => (s.agentSlug === selectedSlug ? { ...s, version: updated.version, updatedAt: updated.updatedAt } : s)));
        // Refresh history
        fetch(`/api/admin/settings/skills/${encodeURIComponent(selectedSlug)}/history`)
          .then((r) => r.json())
          .then((data) => setHistory(data.history ?? []))
          .catch(() => {});
      }
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold mb-6">General</h1>
        <Card className="mb-10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Analysis Cooldown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              How long before the same URL can be re-analyzed. Set to 0 to disable. Admins can reset individual URLs from the profile page.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={cooldownDays}
                  onChange={(e) => setCooldownDays(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <Button
                size="sm"
                onClick={handleSaveCooldown}
                disabled={cooldownSaving}
              >
                {cooldownSaving ? "Saving..." : cooldownSaved ? "Saved" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

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
                  <li key={s.agentSlug} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSlug(s.agentSlug)}
                      className={cn(
                        "flex-1 text-left px-2 py-1.5 rounded text-sm",
                        selectedSlug === s.agentSlug
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                        !s.active && "opacity-50 line-through"
                      )}
                    >
                      {s.agentName}
                    </button>
                    <button
                      type="button"
                      title={s.active ? "Disable agent" : "Enable agent"}
                      onClick={() => handleToggleActive(s.agentSlug, s.active)}
                      className={cn(
                        "shrink-0 w-7 h-4 rounded-full relative transition-colors",
                        s.active ? "bg-green-500" : "bg-muted-foreground/30"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                        s.active ? "left-3.5" : "left-0.5"
                      )} />
                    </button>
                  </li>
                ))}
            </ul>
            <p className="text-xs font-medium text-muted-foreground mb-2">Creative</p>
            <ul className="space-y-1">
              {skills
                .filter((s) => CREATIVE_SLUGS.includes(s.agentSlug))
                .map((s) => (
                  <li key={s.agentSlug} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSlug(s.agentSlug)}
                      className={cn(
                        "flex-1 text-left px-2 py-1.5 rounded text-sm",
                        selectedSlug === s.agentSlug
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                        !s.active && "opacity-50 line-through"
                      )}
                    >
                      {s.agentName}
                    </button>
                    <button
                      type="button"
                      title={s.active ? "Disable agent" : "Enable agent"}
                      onClick={() => handleToggleActive(s.agentSlug, s.active)}
                      className={cn(
                        "shrink-0 w-7 h-4 rounded-full relative transition-colors",
                        s.active ? "bg-green-500" : "bg-muted-foreground/30"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                        s.active ? "left-3.5" : "left-0.5"
                      )} />
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
                      {!detail.active && <span className="ml-2 text-destructive font-medium">(Disabled)</span>}
                    </p>
                  </div>
                  <Button size="sm" onClick={handleSaveSkill} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <select
                    value={form.modelOverride}
                    onChange={(e) => setForm((f) => ({ ...f, modelOverride: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Default</option>
                    {form.modelOverride && !ALL_MODEL_VALUES.includes(form.modelOverride) && (
                      <option value={form.modelOverride} disabled>
                        Custom: {form.modelOverride}
                      </option>
                    )}
                    {ANTHROPIC_MODELS.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.models.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
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
                      step={0.05}
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
                <div className="space-y-2">
                  <Label>Change note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    placeholder="Describe what you changed and why"
                    className="text-sm"
                  />
                </div>
                {/* Version History */}
                <div className="border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className={cn("transition-transform", showHistory && "rotate-90")}>&#9654;</span>
                    History ({history.length} versions)
                  </button>
                  {showHistory && history.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {history.slice(0, 10).map((h) => (
                        <li key={h.id} className="rounded border border-border p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">v{h.version}</span>
                            <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()}</span>
                          </div>
                          {h.changeNote && <p className="text-muted-foreground mt-1">{h.changeNote}</p>}
                          {h.editedBy && <p className="text-muted-foreground">by {h.editedBy}</p>}
                          <p className="mt-1 font-mono text-muted-foreground truncate">{h.systemPrompt.slice(0, 150)}...</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 h-6 text-xs"
                            disabled={rollingBack}
                            onClick={() => handleRollback(h.version)}
                          >
                            Restore v{h.version}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {showHistory && history.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">No previous versions.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Select an agent to edit.</p>
            )}
          </div>
        </div>
        <h1 className="text-2xl font-semibold mb-6 mt-10">Delivery Platforms</h1>
        <div className="flex flex-1 min-h-0 gap-4 border rounded-lg border-border bg-card p-4">
          <div className="w-56 shrink-0 border-r border-border pr-4 overflow-y-auto">
            <ul className="space-y-1">
              {platforms.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPlatformId(p.id)}
                    className={cn(
                      "flex-1 text-left px-2 py-1.5 rounded text-sm",
                      selectedPlatformId === p.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                      !p.enabled && "opacity-50 line-through"
                    )}
                  >
                    {p.label}
                  </button>
                  <button
                    type="button"
                    title={p.enabled ? "Disable platform" : "Enable platform"}
                    onClick={() => handleTogglePlatform(p.id, p.enabled)}
                    className={cn(
                      "shrink-0 w-7 h-4 rounded-full relative transition-colors",
                      p.enabled ? "bg-green-500" : "bg-muted-foreground/30"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                      p.enabled ? "left-3.5" : "left-0.5"
                    )} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 min-w-0">
            {selectedPlatformId ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{platforms.find((p) => p.id === selectedPlatformId)?.key}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeletePlatform(selectedPlatformId)}
                    >
                      Delete
                    </Button>
                    <Button size="sm" onClick={handleSavePlatform} disabled={platformSaving}>
                      {platformSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    value={platformForm.label}
                    onChange={(e) => setPlatformForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={platformForm.enabled}
                      onChange={(e) => setPlatformForm((f) => ({ ...f, enabled: e.target.checked }))}
                      className="rounded"
                    />
                    Enabled
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={platformForm.sectionSplit}
                      onChange={(e) => setPlatformForm((f) => ({ ...f, sectionSplit: e.target.checked }))}
                      className="rounded"
                    />
                    Section split (Squarespace-style)
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Platform notes</Label>
                  <textarea
                    value={platformForm.platformNotes}
                    onChange={(e) => setPlatformForm((f) => ({ ...f, platformNotes: e.target.value }))}
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>README template</Label>
                  <textarea
                    value={platformForm.readmeTemplate}
                    onChange={(e) => setPlatformForm((f) => ({ ...f, readmeTemplate: e.target.value }))}
                    className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Folder structure <span className="text-muted-foreground font-normal">(JSON)</span></Label>
                  <textarea
                    value={platformForm.folderStructure}
                    onChange={(e) => setPlatformForm((f) => ({ ...f, folderStructure: e.target.value }))}
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                    spellCheck={false}
                  />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Select a platform to edit.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
