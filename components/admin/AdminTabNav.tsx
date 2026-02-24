"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Analyses", href: "/admin", match: (path: string) => path === "/admin" },
  { label: "Benchmarks", href: "/admin/benchmarks", match: (path: string) => path.startsWith("/admin/benchmark") },
  { label: "Settings", href: "/admin/settings", match: (path: string) => path.startsWith("/admin/settings") },
] as const;

export function AdminTabNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto max-w-5xl px-6 pt-4">
        <div className="flex gap-6">
          {TABS.map((tab) => {
            const isActive = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "pb-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
