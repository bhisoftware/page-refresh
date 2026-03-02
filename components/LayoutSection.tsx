"use client";

import { LayoutTabbedViewer } from "@/components/LayoutTabbedViewer";

export interface LayoutItem {
  layoutIndex: 1 | 2 | 3;
  templateName: string;
  layoutHtml: string;
  layoutCss: string;
  layoutCopyRefreshed: string;
  rationale?: string;
}

interface LayoutSectionProps {
  refreshId: string;
  viewToken: string;
  layouts: LayoutItem[];
}

export function LayoutSection({ refreshId, viewToken, layouts }: LayoutSectionProps) {
  if (!layouts.length) return null;

  return (
    <section className="mb-10 relative w-screen left-1/2 -translate-x-1/2 overflow-hidden">
      <div className="px-4 sm:px-8 lg:px-12 max-w-[1400px] mx-auto">
        <LayoutTabbedViewer
          refreshId={refreshId}
          viewToken={viewToken}
          layouts={layouts}
        />
      </div>
    </section>
  );
}
