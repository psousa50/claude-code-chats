"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface GlobalSearchProps {
  projectPath?: string;
}

export function GlobalSearch({ projectPath }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

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
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
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
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm placeholder-neutral-500 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition-colors"
      />
    </form>
  );
}
