"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DesignCopyMode = "design" | "design-copy";

interface DesignCopyToggleProps {
  value: DesignCopyMode;
  onChange: (value: DesignCopyMode) => void;
  className?: string;
}

export function DesignCopyToggle({
  value,
  onChange,
  className,
}: DesignCopyToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-input bg-muted/50 p-0.5",
        className
      )}
      role="tablist"
      aria-label="Preview mode"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        role="tab"
        aria-selected={value === "design"}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          value === "design"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("design")}
      >
        Design
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        role="tab"
        aria-selected={value === "design-copy"}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          value === "design-copy"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("design-copy")}
      >
        Design + Copy
      </Button>
    </div>
  );
}
