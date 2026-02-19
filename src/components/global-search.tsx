"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface GlobalSearchProps {
  projectPath?: string;
}

export function GlobalSearch({ projectPath }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        const params = new URLSearchParams({ q: query.trim() });
        if (projectPath) {
          params.set("project", projectPath);
        }
        router.push(`/search?${params.toString()}`);
      }
    },
    [query, router, projectPath]
  );

  const placeholder = projectPath ? "Search this project..." : "Search all chats...";

  return (
    <form onSubmit={handleSubmit} className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-16 py-2 bg-surface border border-edge-subtle rounded-xl text-sm text-content-primary placeholder-content-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
      />
      {!query && (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-content-tertiary bg-surface-elevated border border-edge-subtle rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
      )}
    </form>
  );
}
