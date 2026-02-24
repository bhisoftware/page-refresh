"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface BenchmarkDeleteButtonProps {
  benchmarkId: string;
}

export function BenchmarkDeleteButton({ benchmarkId }: BenchmarkDeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!confirm("Delete this benchmark? Notes will be deleted too.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/benchmark/${benchmarkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Benchmark deleted");
      router.push("/admin/benchmarks");
    } catch {
      toast.error("Delete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="destructive" onClick={handleClick} disabled={loading}>
      {loading ? "Deleting..." : "Delete Benchmark"}
    </Button>
  );
}
