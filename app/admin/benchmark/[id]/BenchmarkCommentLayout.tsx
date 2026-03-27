"use client";

import { useState, createContext, useContext, type ReactNode } from "react";
import { CommentSidebar } from "./CommentSidebar";
import type { ThreadedNote } from "./types";

const CommentContext = createContext<{
  addComment: (anchor: string) => void;
  threads: ThreadedNote[];
}>({ addComment: () => {}, threads: [] });

export function useCommentContext() {
  return useContext(CommentContext);
}

interface BenchmarkCommentLayoutProps {
  benchmarkId: string;
  initialThreads: ThreadedNote[];
  children: ReactNode;
}

export function BenchmarkCommentLayout({
  benchmarkId,
  initialThreads,
  children,
}: BenchmarkCommentLayoutProps) {
  const [threads, setThreads] = useState<ThreadedNote[]>(initialThreads);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  return (
    <CommentContext.Provider value={{ addComment: (anchor) => setActiveAnchor(anchor), threads }}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div>{children}</div>
        <div className="hidden lg:block">
          <CommentSidebar
            benchmarkId={benchmarkId}
            threads={threads}
            setThreads={setThreads}
            activeAnchor={activeAnchor}
            setActiveAnchor={setActiveAnchor}
          />
        </div>
      </div>
    </CommentContext.Provider>
  );
}
