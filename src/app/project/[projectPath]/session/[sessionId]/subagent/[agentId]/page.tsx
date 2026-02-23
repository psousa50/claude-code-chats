import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSubagentById } from '@/lib/chat-reader'
import { GlobalSearch } from '@/components/global-search'
import { ThemeToggle } from '@/components/theme-toggle'
import { FontSizeToggle } from '@/components/font-size-toggle'
import { SyncButton } from '@/components/sync-button'
import { ChatView } from '@/components/chat-view'
import { SummarySection } from '@/components/summary-section'
import { isSystemMessage, hasNoVisibleContent } from '@/lib/message-utils'
import { formatRelativeTime, formatDateTime, formatTokenCount } from '@/lib/format'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ projectPath: string; sessionId: string; agentId: string }>
}

export default async function SubagentPage({ params }: Props) {
  const { projectPath, sessionId, agentId } = await params
  const agent = getSubagentById(projectPath, sessionId, agentId)

  if (!agent) {
    notFound()
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge-subtle bg-surface/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectPath}/session/${sessionId}`}
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
                {agent.projectName}
              </h1>
              <p className="text-xs text-content-tertiary truncate font-mono">
                <span className="text-accent">{agent.id}</span>
                <span className="mx-1.5 opacity-40">·</span>
                subagent
              </p>
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
        <div className="mb-6 bg-surface border border-edge-subtle rounded-xl animate-in">
          <div className="px-4 py-3 flex items-center gap-4 text-sm text-content-secondary">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              {agent.messageCount} messages
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatRelativeTime(agent.lastActivity)}
            </span>
            <span className="text-xs text-content-tertiary hidden sm:inline">
              {formatDateTime(agent.lastActivity)}
            </span>
          </div>

          {agent.tokenUsage && (
            <div className="border-t border-edge-subtle px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-content-tertiary font-medium">Tokens</span>
              <span>
                <span className="text-content-tertiary">in</span>{' '}
                <span className="text-content-primary font-mono">
                  {formatTokenCount(agent.tokenUsage.input_tokens)}
                </span>
              </span>
              <span>
                <span className="text-content-tertiary">out</span>{' '}
                <span className="text-content-primary font-mono">
                  {formatTokenCount(agent.tokenUsage.output_tokens)}
                </span>
              </span>
              <span>
                <span className="text-content-tertiary">cache read</span>{' '}
                <span className="text-content-primary font-mono">
                  {formatTokenCount(agent.tokenUsage.cache_read_input_tokens)}
                </span>
              </span>
              <span>
                <span className="text-content-tertiary">cache write</span>{' '}
                <span className="text-content-primary font-mono">
                  {formatTokenCount(agent.tokenUsage.cache_creation_input_tokens)}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="mb-6 animate-in stagger-1">
          <SummarySection
            type="session"
            projectPath={projectPath}
            sessionId={sessionId}
            agentId={agentId}
            messageCount={agent.messageCount}
          />
        </div>

        <ChatView messages={agent.messages} showHidden={false} />
      </main>
    </div>
  )
}
