import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionById } from "@/lib/chat-reader";
import { ChatView } from "@/components/chat-view";
import { formatRelativeTime, formatDateTime } from "@/lib/format";
import { GlobalSearch } from "@/components/global-search";
import { SummarySection } from "@/components/summary-section";
import { ResumeCommandCopy } from "@/components/resume-command-copy";
import { DuplicateSessionButton } from "@/components/duplicate-session-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ projectPath: string; sessionId: string }>;
  searchParams: Promise<{ highlight?: string }>;
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { projectPath, sessionId } = await params;
  const { highlight } = await searchParams;
  const session = getSessionById(projectPath, sessionId);

  if (!session) {
    notFound();
  }


  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectPath}`}
              className="p-2 -ml-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0 hidden sm:block">
              <h1 className="text-lg font-semibold text-neutral-100 truncate">{session.projectName}</h1>
              <p className="text-xs text-neutral-500 truncate font-mono">{session.id}</p>
            </div>
            <div className="flex-1 max-w-md">
              <GlobalSearch projectPath={projectPath} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-4 text-sm text-neutral-400">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                {session.messageCount} messages
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatRelativeTime(session.lastActivity)}
              </span>
            </div>
            <p className="text-xs text-neutral-600">
              Last active: {formatDateTime(session.lastActivity)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <DuplicateSessionButton
              encodedPath={projectPath}
              sessionId={session.id}
              messageCount={session.messageCount}
            />
            <ResumeCommandCopy sessionId={session.id} />
          </div>
        </div>

        <div className="mb-6">
          <SummarySection
            type="session"
            projectPath={projectPath}
            sessionId={sessionId}
            messageCount={session.messageCount}
          />
        </div>

        <ChatView messages={session.messages} highlightMessageId={highlight} />
      </main>
    </div>
  );
}
