"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface DiscoveredSite {
  url: string;
  title: string;
}

interface BenchmarkListActionsProps {
  industries: string[];
}

export function BenchmarkListActions({ industries }: BenchmarkListActionsProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [industry, setIndustry] = useState(industries[0] ?? "");
  const [adding, setAdding] = useState(false);
  const [scoringAll, setScoringAll] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredSite[] | null>(null);
  const [creating, setCreating] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !industry.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), industry: industry.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed");
      }
      setUrl("");
      toast.success("Benchmark added");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const handleScoreAll = async () => {
    setScoringAll(true);
    try {
      const res = await fetch("/api/admin/benchmarks/score-all", { method: "POST" });
      const data = (await res.json()) as { scored?: number; failed?: number; errors?: string[] };
      if (!res.ok) throw new Error("Score-all failed");
      toast.success(`Scored: ${data.scored ?? 0}, Failed: ${data.failed ?? 0}`);
      if ((data.errors?.length ?? 0) > 0) console.warn("Score-all errors:", data.errors);
      router.refresh();
    } catch {
      toast.error("Score all failed");
    } finally {
      setScoringAll(false);
    }
  };

  const handleDiscover = async () => {
    if (!industry.trim()) return;
    setDiscovering(true);
    setDiscovered(null);
    try {
      const res = await fetch("/api/admin/benchmarks/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: industry.trim(), count: 10 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Discovery failed");
      }
      const data = (await res.json()) as { discovered: DiscoveredSite[] };
      setDiscovered(data.discovered);
      if (data.discovered.length === 0) {
        toast.info("No new competitor sites found for this industry");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const handleCreateFromDiscovered = async () => {
    if (!industry.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/benchmarks/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: industry.trim(), count: 10, create: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Creation failed");
      }
      const data = (await res.json()) as { created: { id: string; url: string }[] };
      toast.success(`Added ${data.created.length} benchmark(s)`);
      setDiscovered(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-wrap gap-4 items-end">
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
          <Input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-64"
            disabled={adding}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
            value={industry}
            onChange={(e) => { setIndustry(e.target.value); setDiscovered(null); }}
            disabled={adding}
          >
            {industries.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <Button type="submit" disabled={adding || !url.trim()}>
            {adding ? "Adding..." : "Add Benchmark"}
          </Button>
        </form>
        <Button variant="outline" onClick={handleScoreAll} disabled={scoringAll}>
          {scoringAll ? "Scoring..." : "Score All Unscored"}
        </Button>
        <Button variant="outline" onClick={handleDiscover} disabled={discovering || !industry.trim()}>
          {discovering ? "Discovering..." : "Discover Competitors"}
        </Button>
      </div>

      {discovered && discovered.length > 0 && (
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Found {discovered.length} competitor site(s) for {industry}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateFromDiscovered} disabled={creating}>
                {creating ? "Adding..." : "Add All as Benchmarks"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDiscovered(null)}>
                Dismiss
              </Button>
            </div>
          </div>
          <ul className="space-y-1 text-sm">
            {discovered.map((site) => (
              <li key={site.url} className="flex gap-2">
                <span className="text-muted-foreground truncate max-w-[400px]">{site.url}</span>
                <span className="text-muted-foreground/60">— {site.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
