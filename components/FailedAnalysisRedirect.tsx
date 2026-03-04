"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function FailedAnalysisRedirect({ url }: { url: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(`/?retry=${encodeURIComponent(url)}`);
    }, 2500);
    return () => clearTimeout(timer);
  }, [router, url]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <h1 className="text-xl font-semibold">Retrying your analysis</h1>
        <p className="text-muted-foreground">
          We had trouble scanning your site. Restarting automatically&hellip;
        </p>
      </div>
    </main>
  );
}
