"use client";

import { useState, useMemo, useEffect } from "react";
import { SessionSummary } from "@/lib/types";
import { SessionCard } from "./session-card";
import { SearchInput } from "./search-input";

const PAGE_SIZE = 30;

interface SessionListProps {
  sessions: SessionSummary[];
  encodedPath: string;
}

export function SessionList({ sessions, encodedPath }: SessionListProps) {
  const [search, setSearch] = useState("");
  const [hideShort, setHideShort] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sessions]);

  const shortCount = useMemo(() => sessions.filter((s) => s.messageCount < 3).length, [sessions]);

  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    if (hideShort) {
      filtered = filtered.filter((s) => s.messageCount >= 3);
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.firstMessage.toLowerCase().includes(searchLower) ||
          s.id.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [sessions, search, hideShort]);

  const paginatedSessions = filteredSessions.slice(0, visibleCount);
  const hasMore = visibleCount < filteredSessions.length;

  function handleSearchChange(value: string) {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  }

  function handleHideShortChange(value: boolean) {
    setHideShort(value);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search sessions..."
          />
        </div>
        {shortCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={hideShort}
              onChange={(e) => handleHideShortChange(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800"
            />
            Hide short ({shortCount})
          </label>
        )}
      </div>

      {filteredSessions.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          {search ? "No sessions found matching your search" : "No sessions found"}
        </div>
      ) : (
        <div className="grid gap-3">
          {paginatedSessions.map((session) => (
            <SessionCard key={session.id} session={session} encodedPath={encodedPath} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-neutral-600">
        <span>Showing {paginatedSessions.length} of {sessions.length} sessions{filteredSessions.length < sessions.length && ` (${sessions.length - filteredSessions.length} hidden)`}</span>
        {hasMore && (
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-3 py-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 rounded-lg transition-colors"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
