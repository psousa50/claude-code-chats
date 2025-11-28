import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionsSummary } from "@/lib/chat-reader";
import { SessionList } from "@/components/session-list";
import { formatRelativeTime } from "@/lib/format";
import { GlobalSearch } from "@/components/global-search";
import { SummarySection } from "@/components/summary-section";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ projectPath: string }>;
}

function decodeProjectPath(encodedPath: string): string {
  return encodedPath.replace(/-/g, "/");
}

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

export default async function ProjectPage({ params }: Props) {
  const { projectPath } = await params;
  const sessions = getSessionsSummary(projectPath);

  if (sessions.length === 0) {
    notFound();
  }

  const decodedPath = decodeProjectPath(projectPath);
  const projectName = extractProjectName(decodedPath);
  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
  const lastActivity = Math.max(...sessions.map((s) => s.lastActivity));

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 -ml-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0 hidden sm:block">
              <h1 className="text-lg font-semibold text-neutral-100 truncate">{projectName}</h1>
              <p className="text-xs text-neutral-500 truncate">{decodedPath}</p>
            </div>
            <div className="flex-1 max-w-md">
              <GlobalSearch projectPath={projectPath} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-4 mb-6 text-sm text-neutral-400">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {sessions.length} sessions
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
            projectPath={projectPath}
            messageCount={totalMessages}
          />
        </div>

        <SessionList sessions={sessions} encodedPath={projectPath} />
      </main>
    </div>
  );
}
