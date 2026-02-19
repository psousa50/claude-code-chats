import Link from "next/link";
import { SessionSummary } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";

interface SessionCardProps {
  session: SessionSummary;
  encodedPath: string;
}

export function SessionCard({ session, encodedPath }: SessionCardProps) {
  return (
    <Link
      href={`/project/${encodedPath}/session/${session.id}`}
      className="block p-4 bg-surface border border-edge-subtle rounded-xl hover:border-edge-hover hover:bg-surface-elevated transition-all duration-300 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-content-primary line-clamp-2 group-hover:text-accent transition-colors">
            {session.firstMessage || "Empty session"}
          </p>
        </div>
        <div className="flex items-center gap-1 text-content-tertiary group-hover:text-accent shrink-0 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-content-tertiary">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          {session.messageCount} messages
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatRelativeTime(session.lastActivity)}
        </span>
      </div>

      <div className="mt-2 text-[11px] text-content-tertiary font-mono truncate opacity-50">
        {session.id}
      </div>
    </Link>
  );
}
