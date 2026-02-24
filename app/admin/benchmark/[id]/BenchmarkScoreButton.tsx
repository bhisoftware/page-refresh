"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface BenchmarkScoreButtonProps {
  benchmarkId: string;
  scored: boolean;
}

export function BenchmarkScoreButton({ benchmarkId, scored }: BenchmarkScoreButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/benchmark/${benchmarkId}/score`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Score failed");
      }
      toast.success("Scoring complete");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Score failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading ? "Scoring..." : scored ? "Re-score" : "Score"}
    </Button>
  );
}
