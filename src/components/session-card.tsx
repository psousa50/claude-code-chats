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
      className="block p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg hover:border-amber-600/50 hover:bg-neutral-900 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-neutral-200 line-clamp-2 group-hover:text-amber-500 transition-colors">
            {session.firstMessage || "Empty session"}
          </p>
        </div>
        <div className="flex items-center gap-1 text-neutral-500 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
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

      <div className="mt-2 text-xs text-neutral-600 font-mono truncate">
        {session.id}
      </div>
    </Link>
  );
}
