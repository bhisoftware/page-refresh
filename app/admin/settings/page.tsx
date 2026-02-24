"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsSkillsEditor } from "./SettingsSkillsEditor";

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

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic — Claude", hasSkills: true },
  { id: "openai", name: "OpenAI", hasSkills: false },
  { id: "screenshotone", name: "ScreenshotOne", hasSkills: false },
] as const;

export default function AdminSettingsPage() {
  const [configs, setConfigs] = useState<ConfigsResponse | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; error?: string; latency?: number }>>({});
  const [skillsOpen, setSkillsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings/configs")
      .then((r) => r.json())
      .then(setConfigs)
      .catch(() => setConfigs({ configs: {} }));
  }, []);

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

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold mb-6">API Settings</h1>
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
                    {provider.hasSkills && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSkillsOpen(true)}
                      >
                        View Agent Skills
                      </Button>
                    )}
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
      </div>
      <SettingsSkillsEditor open={skillsOpen} onOpenChange={setSkillsOpen} />
    </main>
  );
}
