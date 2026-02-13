"use client";

import { useState, useEffect } from "react";
import { SessionSummary } from "@/lib/types";
import { SessionList } from "./session-list";
import { ProjectHeader } from "./project-header";
import { SummarySection } from "./summary-section";
import { formatRelativeTime } from "@/lib/format";

interface ProjectData {
  sessions: SessionSummary[];
  projectName: string;
  decodedPath: string;
  hasMemory?: boolean;
}

const cache = new Map<string, ProjectData>();

function SessionListSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg"
        >
          <div className="h-4 w-3/4 bg-neutral-800 rounded animate-pulse" />
          <div className="flex items-center gap-4 mt-3">
            <div className="h-3 w-20 bg-neutral-800/50 rounded animate-pulse" />
            <div className="h-3 w-16 bg-neutral-800/50 rounded animate-pulse ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectPageContent({ encodedPath }: { encodedPath: string }) {
  const [data, setData] = useState<ProjectData | null>(cache.get(encodedPath) ?? null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/sessions?path=${encodeURIComponent(encodedPath)}`)
      .then((res) => res.json())
      .then((d: ProjectData) => {
        if (cancelled) return;
        cache.set(encodedPath, d);
        setData(d);
      });
    return () => { cancelled = true; };
  }, [encodedPath]);

  const totalMessages = data?.sessions.reduce((sum, s) => sum + s.messageCount, 0) ?? 0;
  const lastActivity = data ? Math.max(...data.sessions.map((s) => s.lastActivity)) : 0;

  return (
    <div className="min-h-screen">
      <ProjectHeader
        projectName={data?.projectName ?? encodedPath}
        projectPath={data?.decodedPath ?? encodedPath}
        encodedPath={encodedPath}
        hasMemory={data?.hasMemory ?? false}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {data ? (
          <>
            <div className="flex items-center gap-4 mb-6 text-sm text-neutral-400">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {data.sessions.length} sessions
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                {totalMessages} messages
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Last active {formatRelativeTime(lastActivity)}
              </span>
            </div>

            <div className="mb-6">
              <SummarySection
                type="project"
                projectPath={encodedPath}
                messageCount={totalMessages}
              />
            </div>

            <SessionList key={encodedPath} sessions={data.sessions} encodedPath={encodedPath} />
          </>
        ) : (
          <SessionListSkeleton />
        )}
      </main>
    </div>
  );
}
