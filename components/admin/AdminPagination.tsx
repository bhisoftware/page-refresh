"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  basePath: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [50, 100];

export function AdminPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  basePath,
}: AdminPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildUrl(page: number, newPageSize: number) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(page));
    params.set("pageSize", String(newPageSize));
    return `${basePath}?${params.toString()}`;
  }

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newSize = Number(e.target.value);
    router.push(buildUrl(1, newSize));
  }

  if (totalPages <= 1 && totalItems <= pageSizeOptions[0]) {
    return (
      <div className="flex items-center justify-end gap-4 py-3 px-4 text-sm text-muted-foreground">
        <span>{totalItems} items</span>
        {pageSizeOptions.length > 1 && (
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3 px-4 border-t border-border">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <span>{totalItems} total</span>
        <select
          value={pageSize}
          onChange={handlePageSizeChange}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        {currentPage <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
        ) : (
          <Link
            href={buildUrl(currentPage - 1, pageSize)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Link>
        )}
        {currentPage >= totalPages ? (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Link
            href={buildUrl(currentPage + 1, pageSize)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        )}
      </div>
    </div>
  );
}
