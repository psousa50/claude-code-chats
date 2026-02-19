import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSessionById } from '@/lib/chat-reader'
import { GlobalSearch } from '@/components/global-search'
import { ThemeToggle } from '@/components/theme-toggle'
import { FontSizeToggle } from '@/components/font-size-toggle'
import { SyncButton } from '@/components/sync-button'
import { SessionContent } from '@/components/session-content'
import { isSystemMessage, hasNoVisibleContent } from '@/lib/message-utils'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ projectPath: string; sessionId: string }>
  searchParams: Promise<{ highlight?: string }>
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { projectPath, sessionId } = await params
  const { highlight } = await searchParams
  const session = getSessionById(projectPath, sessionId)

  if (!session) {
    notFound()
  }

  const totalMessageCount = session.messages.length
  const strippedMessageCount = session.messages.filter(
    (m) => !isSystemMessage(m) && !hasNoVisibleContent(m),
  ).length

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge-subtle bg-surface/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectPath}`}
              className="p-2 -ml-2 text-content-tertiary hover:text-content-primary hover:bg-surface-elevated rounded-lg transition-all flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <div className="flex-1 min-w-0 hidden sm:block">
              <h1 className="text-lg font-medium text-content-primary truncate">
                {session.projectName}
              </h1>
              <p className="text-xs text-content-tertiary truncate font-mono">{session.id}</p>
            </div>
            <div className="flex-1 max-w-md">
              <GlobalSearch projectPath={projectPath} />
            </div>
            <FontSizeToggle />
            <ThemeToggle />
            <SyncButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <SessionContent
          projectPath={projectPath}
          sessionId={session.id}
          messageCount={session.messageCount}
          lastActivity={session.lastActivity}
          tokenUsage={session.tokenUsage ?? null}
          totalMessageCount={totalMessageCount}
          strippedMessageCount={strippedMessageCount}
          messages={session.messages}
          highlightMessageId={highlight}
        />
      </main>
    </div>
  )
}
