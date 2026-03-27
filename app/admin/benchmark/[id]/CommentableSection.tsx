"use client";

import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useCommentContext } from "./BenchmarkCommentLayout";

const INITIALS_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface SubAnchor {
  value: string;
  label: string;
}

interface CommentableSectionProps {
  anchor: string;
  subAnchors?: SubAnchor[];
  children: ReactNode;
}

export function CommentableSection({ anchor, subAnchors, children }: CommentableSectionProps) {
  const { addComment, threads } = useCommentContext();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  // Count threads for this anchor + any sub-anchors
  const allAnchors = useMemo(
    () => [anchor, ...(subAnchors?.map((s) => s.value) ?? [])],
    [anchor, subAnchors],
  );

  const anchorThreads = useMemo(
    () => threads.filter((t) => t.anchor !== null && allAnchors.includes(t.anchor) && t.resolvedAt === null),
    [threads, allAnchors],
  );

  const openCount = anchorThreads.length;

  const uniqueAuthors = useMemo(() => {
    const seen = new Set<string>();
    return anchorThreads
      .map((t) => t.authorName)
      .filter((name) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .slice(0, 3);
  }, [anchorThreads]);

  const handleClick = () => {
    if (subAnchors && subAnchors.length > 0) {
      setShowMenu(!showMenu);
    } else {
      addComment(anchor);
    }
  };

  const handleSubAnchorClick = (value: string) => {
    setShowMenu(false);
    addComment(value);
  };

  return (
    <div className="relative group/section" data-anchor={anchor}>
      {children}

      {/* Comment controls at right edge */}
      <div className="absolute -right-4 top-4 flex flex-col items-center gap-1.5" ref={menuRef}>
        {/* Add comment button (hover only) */}
        <button
          type="button"
          onClick={handleClick}
          className="p-1.5 rounded-full bg-emerald-500 border border-emerald-600 shadow-sm
                     opacity-0 group-hover/section:opacity-100 transition-opacity hover:bg-emerald-600"
          aria-label={`Comment on ${anchor}`}
        >
          <MessageSquarePlus className="h-4 w-4 text-white" />
        </button>

        {/* Sub-anchor dropdown menu */}
        {showMenu && subAnchors && (
          <div className="absolute top-9 right-0 z-20 bg-background border rounded-lg shadow-lg py-1 min-w-[160px]">
            {subAnchors.map((sub) => (
              <button
                key={sub.value}
                type="button"
                onClick={() => handleSubAnchorClick(sub.value)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {/* Author initials (always visible when comments exist) */}
        {uniqueAuthors.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {uniqueAuthors.map((name) => (
              <div
                key={name}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${INITIALS_COLORS[hashName(name) % INITIALS_COLORS.length]}`}
                title={name}
              >
                {getInitials(name)}
              </div>
            ))}
          </div>
        )}

        {/* Comment count badge */}
        {openCount > 0 && (
          <div className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center px-1 shadow-sm">
            {openCount}
          </div>
        )}
      </div>
    </div>
  );
}
