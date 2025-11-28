"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";

interface SearchResult {
  content: string;
  sessionId: string;
  projectPath: string;
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

function decodeProjectPath(encodedPath: string): string {
  return encodedPath.replace(/-/g, "/");
}

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

export function SearchResults({ query }: { query: string }) {
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
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);

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
  }, [query]);

  if (!query.trim()) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 mx-auto text-neutral-700 mb-4"
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
        <p className="text-neutral-400">Enter a search query to find messages across all chats</p>
        {stats && (
          <p className="text-sm text-neutral-600 mt-2">
            {stats.messageCount.toLocaleString()} messages indexed across {stats.fileCount} sessions
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 mx-auto border-2 border-neutral-700 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-neutral-400">Searching...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 mx-auto text-red-500 mb-4"
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
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 mx-auto text-neutral-700 mb-4"
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
        <p className="text-neutral-400">No results found for &ldquo;{query}&rdquo;</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-neutral-500 mb-4">
        Found {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
      </p>

      <div className="space-y-3">
        {results.map((result, index) => {
          const decodedPath = decodeProjectPath(result.projectPath);
          const projectName = extractProjectName(decodedPath);

          return (
            <Link
              key={`${result.sessionId}-${result.messageUuid}-${index}`}
              href={`/project/${result.projectPath}/session/${result.sessionId}?highlight=${result.messageUuid}`}
              className="block p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      result.userType === "user"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {result.userType}
                  </span>
                  <span className="text-neutral-400">{projectName}</span>
                </div>
                {result.timestamp > 0 && (
                  <span className="text-xs text-neutral-600 whitespace-nowrap">
                    {formatRelativeTime(result.timestamp)}
                  </span>
                )}
              </div>

              <p
                className="text-sm text-neutral-300 line-clamp-3 [&>mark]:bg-amber-500/30 [&>mark]:text-amber-200 [&>mark]:px-0.5 [&>mark]:rounded"
                dangerouslySetInnerHTML={{ __html: result.snippet }}
              />

              <p className="text-xs text-neutral-600 mt-2 font-mono truncate">{result.sessionId}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
