'use client'

import { useState } from 'react'
import { ChatMessage } from '@/lib/types'
import { formatRelativeTime, formatDateTime, formatTokenCount } from '@/lib/format'
import { ChatView } from './chat-view'
import { ResumeCommandCopy } from './resume-command-copy'
import { DuplicateSessionButton } from './duplicate-session-button'
import { DeleteSessionButton } from './delete-session-button'
import { SummarySection } from './summary-section'
import { SubagentList } from './subagent-list'
import { ExportButton } from './export-button'
import { SubagentSummary } from '@/lib/types'

interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

interface SessionContentProps {
  projectPath: string
  sessionId: string
  messageCount: number
  lastActivity: number
  tokenUsage: TokenUsage | null
  totalMessageCount: number
  strippedMessageCount: number
  messages: ChatMessage[]
  highlightMessageId?: string
  subagents?: SubagentSummary[]
}

export function SessionContent({
  projectPath,
  sessionId,
  messageCount,
  lastActivity,
  tokenUsage,
  totalMessageCount,
  strippedMessageCount,
  messages,
  highlightMessageId,
  subagents,
}: SessionContentProps) {
  const [showHidden, setShowHidden] = useState(false)

  return (
    <>
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
            {messageCount} messages
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
            {formatRelativeTime(lastActivity)}
          </span>
          <span className="text-xs text-content-tertiary hidden sm:inline">
            {formatDateTime(lastActivity)}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-content-tertiary cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-edge-hover bg-surface-elevated text-accent focus:ring-accent focus:ring-offset-0"
            />
            System messages
          </label>
        </div>

        <div className="border-t border-edge-subtle px-4 py-3">
          <ResumeCommandCopy sessionId={sessionId} />
        </div>

        {tokenUsage && (
          <div className="border-t border-edge-subtle px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-content-tertiary font-medium">Tokens</span>
            <span>
              <span className="text-content-tertiary">in</span>{' '}
              <span className="text-content-primary font-mono">
                {formatTokenCount(tokenUsage.input_tokens)}
              </span>
            </span>
            <span>
              <span className="text-content-tertiary">out</span>{' '}
              <span className="text-content-primary font-mono">
                {formatTokenCount(tokenUsage.output_tokens)}
              </span>
            </span>
            <span>
              <span className="text-content-tertiary">cache read</span>{' '}
              <span className="text-content-primary font-mono">
                {formatTokenCount(tokenUsage.cache_read_input_tokens)}
              </span>
            </span>
            <span>
              <span className="text-content-tertiary">cache write</span>{' '}
              <span className="text-content-primary font-mono">
                {formatTokenCount(tokenUsage.cache_creation_input_tokens)}
              </span>
            </span>
          </div>
        )}

        <div className="border-t border-edge-subtle px-4 py-2.5 flex items-center justify-end gap-2">
          {subagents && subagents.length > 0 && (
            <button
              onClick={() => {
                const el = document.getElementById('subagents')
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 80
                  window.scrollTo({ top, behavior: 'smooth' })
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent hover:text-accent-hover hover:bg-accent/10 border border-accent/20 rounded-lg transition-all mr-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                />
              </svg>
              {subagents.length} sub-agent{subagents.length !== 1 ? 's' : ''}
            </button>
          )}
          <ExportButton encodedPath={projectPath} sessionId={sessionId} />
          <DuplicateSessionButton
            encodedPath={projectPath}
            sessionId={sessionId}
            totalMessageCount={totalMessageCount}
            strippedMessageCount={strippedMessageCount}
          />
          <DeleteSessionButton encodedPath={projectPath} sessionId={sessionId} />
        </div>
      </div>

      <div className="mb-6 animate-in stagger-1">
        <SummarySection
          type="session"
          projectPath={projectPath}
          sessionId={sessionId}
          messageCount={messageCount}
        />
      </div>

      <ChatView
        messages={messages}
        highlightMessageId={highlightMessageId}
        showHidden={showHidden}
        subagents={subagents}
      />

      {subagents && subagents.length > 0 && (
        <SubagentList subagents={subagents} projectPath={projectPath} sessionId={sessionId} />
      )}
    </>
  )
}
