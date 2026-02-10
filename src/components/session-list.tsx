"use client";

import { useState, useMemo } from "react";
import { SessionSummary } from "@/lib/types";
import { SessionCard } from "./session-card";
import { SearchInput } from "./search-input";

interface SessionListProps {
  sessions: SessionSummary[];
  encodedPath: string;
}

export function SessionList({ sessions, encodedPath }: SessionListProps) {
  const [search, setSearch] = useState("");
  const [hideShort, setHideShort] = useState(true);

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

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search sessions..."
          />
        </div>
        {shortCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={hideShort}
              onChange={(e) => setHideShort(e.target.checked)}
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
          {filteredSessions.map((session) => (
            <SessionCard key={session.id} session={session} encodedPath={encodedPath} />
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-neutral-600 text-center">
        {filteredSessions.length} of {sessions.length} sessions
      </div>
    </div>
  );
}
