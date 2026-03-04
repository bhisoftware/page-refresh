"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Share2, Copy, Trash2 } from "lucide-react";

interface ShareReportButtonProps {
  refreshId: string;
  initialShareToken: string | null;
  initialShareExpiry: string | null;
}

export function ShareReportButton({
  refreshId,
  initialShareToken,
  initialShareExpiry,
}: ShareReportButtonProps) {
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [shareExpiry, setShareExpiry] = useState(initialShareExpiry);
  const [loading, setLoading] = useState(false);

  const isExpired = shareExpiry ? new Date(shareExpiry) < new Date() : false;
  const hasActiveLink = shareToken && !isExpired;

  const shareUrl = hasActiveLink
    ? `${window.location.origin}/results/${refreshId}?share=${shareToken}`
    : null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analysis/${refreshId}/share`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const data = await res.json();
      setShareToken(data.shareToken);
      setShareExpiry(data.shareExpiry);
      const url = `${window.location.origin}/results/${refreshId}?share=${data.shareToken}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link generated and copied");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate link"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analysis/${refreshId}/share`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to revoke");
      setShareToken(null);
      setShareExpiry(null);
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke link");
    } finally {
      setLoading(false);
    }
  };

  if (!hasActiveLink) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={loading}
        className="gap-1.5"
      >
        <Share2 className="h-3.5 w-3.5" />
        {shareToken && isExpired
          ? "Link expired — regenerate"
          : "Share report"}
      </Button>
    );
  }

  const expiresAt = new Date(shareExpiry!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">
        Shared until {expiresAt}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        disabled={loading}
        className="gap-1.5"
      >
        <Copy className="h-3.5 w-3.5" />
        Copy link
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRevoke}
        disabled={loading}
        className="gap-1.5 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Revoke
      </Button>
    </div>
  );
}
