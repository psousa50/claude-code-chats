import Link from 'next/link'
import { SubagentSummary } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'

interface SubagentListProps {
  subagents: SubagentSummary[]
  projectPath: string
  sessionId: string
}

export function SubagentList({ subagents, projectPath, sessionId }: SubagentListProps) {
  if (subagents.length === 0) return null

  return (
    <div id="subagents" className="mt-8 animate-in stagger-2">
      <h2 className="text-sm font-medium text-content-secondary mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
          />
        </svg>
        Subagents ({subagents.length})
      </h2>
      <div className="grid gap-2">
        {subagents.map((agent) => (
          <Link
            key={agent.agentId}
            id={`subagent-${agent.agentId}`}
            href={`/project/${projectPath}/session/${sessionId}/subagent/${agent.agentId}`}
            className="block bg-surface border border-edge-subtle rounded-lg px-4 py-3 hover:border-edge-hover hover:bg-surface-elevated transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-accent">{agent.slug}</span>
                  <span className="text-xs text-content-tertiary">·</span>
                  <span className="text-xs text-content-tertiary">
                    {agent.messageCount} messages
                  </span>
                  <span className="text-xs text-content-tertiary">·</span>
                  <span className="text-xs text-content-tertiary">
                    {formatRelativeTime(agent.lastActivity)}
                  </span>
                </div>
                <p className="text-sm text-content-secondary truncate">{agent.firstMessage}</p>
              </div>
              <svg
                className="w-4 h-4 text-content-tertiary group-hover:text-content-secondary flex-shrink-0 mt-0.5 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
