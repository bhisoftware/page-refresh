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
    <section className="mb-10 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* heading removed */}
      <div className="px-4 sm:px-6 lg:px-8">
        <LayoutTabbedViewer
          refreshId={refreshId}
          viewToken={viewToken}
          layouts={layouts}
        />
      </div>
    </section>
  );
}
