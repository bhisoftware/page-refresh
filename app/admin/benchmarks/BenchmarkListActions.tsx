"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface BenchmarkListActionsProps {
  industries: string[];
}

export function BenchmarkListActions({ industries }: BenchmarkListActionsProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [industry, setIndustry] = useState(industries[0] ?? "");
  const [adding, setAdding] = useState(false);
  const [scoringAll, setScoringAll] = useState(false);

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

  return (
    <div className="flex flex-wrap gap-4 items-end mb-6">
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
          onChange={(e) => setIndustry(e.target.value)}
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
    </div>
  );
}
