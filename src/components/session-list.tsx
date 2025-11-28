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

  const filteredSessions = useMemo(() => {
    if (!search.trim()) {
      return sessions;
    }

    const searchLower = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.firstMessage.toLowerCase().includes(searchLower) ||
        s.id.toLowerCase().includes(searchLower)
    );
  }, [sessions, search]);

  return (
    <div>
      <div className="mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search sessions..."
        />
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
