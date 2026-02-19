"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";

interface SearchResult {
  content: string;
  sessionId: string;
  projectPath: string;
  projectName: string;
  messageUuid: string;
  userType: string;
  timestamp: number;
  snippet: string;
  rank: number;
}

interface SearchResponse {
  results: SearchResult[];
  sync: { added: number; updated: number; removed: number };
  stats: { fileCount: number; messageCount: number };
}

interface SearchResultsProps {
  query: string;
  projectPath?: string;
}

export function SearchResults({ query, projectPath }: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<{ fileCount: number; messageCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ q: query });
        if (projectPath) {
          params.set("project", projectPath);
        }
        const response = await fetch(`/api/search?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data: SearchResponse = await response.json();
        setResults(data.results);
        setStats(data.stats);
      } catch {
        setError("Failed to search. Please try again.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, projectPath]);

  if (!query.trim()) {
    return (
      <div className="text-center py-16 animate-fade">
        <svg
          className="w-12 h-12 mx-auto text-content-tertiary/50 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <p className="text-content-secondary">
          Enter a search query to find messages {projectPath ? "in this project" : "across all chats"}
        </p>
        {stats && (
          <p className="text-sm text-content-tertiary mt-2">
            {stats.messageCount.toLocaleString()} messages indexed across {stats.fileCount} sessions
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-16 animate-fade">
        <div className="w-8 h-8 mx-auto border-2 border-edge-hover border-t-accent rounded-full animate-spin mb-4" />
        <p className="text-content-secondary">Searching...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 animate-fade">
        <svg
          className="w-12 h-12 mx-auto text-danger mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16 animate-fade">
        <svg
          className="w-12 h-12 mx-auto text-content-tertiary/50 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-content-secondary">No results found for &ldquo;{query}&rdquo;</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-content-tertiary mb-4 animate-fade">
        Found {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
      </p>

      <div className="space-y-3">
        {results.map((result, index) => {
          return (
            <Link
              key={`${result.sessionId}-${result.messageUuid}-${index}`}
              href={`/project/${result.projectPath}/session/${result.sessionId}?highlight=${result.messageUuid}`}
              className={`block p-4 bg-surface border border-edge-subtle rounded-xl hover:border-edge-hover hover:bg-surface-elevated transition-all duration-300 animate-in stagger-${Math.min(index + 1, 10)}`}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      result.userType === "user"
                        ? "bg-info/15 text-info"
                        : "bg-accent/15 text-accent"
                    }`}
                  >
                    {result.userType}
                  </span>
                  <span className="text-content-secondary">{result.projectName}</span>
                </div>
                {result.timestamp > 0 && (
                  <span className="text-xs text-content-tertiary whitespace-nowrap">
                    {formatRelativeTime(result.timestamp)}
                  </span>
                )}
              </div>

              <p
                className="text-sm text-content-secondary line-clamp-3 [&>mark]:bg-accent/25 [&>mark]:text-accent-hover [&>mark]:px-0.5 [&>mark]:rounded"
                dangerouslySetInnerHTML={{ __html: result.snippet }}
              />

              <p className="text-[11px] text-content-tertiary mt-2 font-mono truncate opacity-50">{result.sessionId}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
