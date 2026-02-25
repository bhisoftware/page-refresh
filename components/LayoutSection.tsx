"use client";

import { useState } from "react";
import { LayoutTabbedViewer } from "@/components/LayoutTabbedViewer";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

export interface LayoutItem {
  layoutIndex: 1 | 2 | 3 | 4 | 5 | 6;
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
  const [showMore, setShowMore] = useState(false);
  const firstThree = layouts.slice(0, 3);
  const moreLayouts = layouts.slice(3, 6);
  const hasMore = moreLayouts.length > 0;

  if (!firstThree.length) return null;

  return (
    <section className="mb-10 -mx-4 sm:-mx-6 lg:-mx-8">
      <h2 className="text-xl font-semibold mb-4 px-4 sm:px-6 lg:px-8">Choose a layout</h2>
      <div className="px-4 sm:px-6 lg:px-8">
        <LayoutTabbedViewer
          refreshId={refreshId}
          viewToken={viewToken}
          layouts={firstThree}
        />
      </div>
      {hasMore && (
        <>
          {showMore ? (
            <div className="px-4 sm:px-6 lg:px-8 mt-6">
              <LayoutTabbedViewer
                refreshId={refreshId}
                viewToken={viewToken}
                layouts={moreLayouts}
              />
            </div>
          ) : (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => setShowMore(true)}
                className="gap-2"
              >
                <ChevronDown className="h-4 w-4" />
                Show More Layouts
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
