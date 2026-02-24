'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { ChatMessage, SubagentSummary } from '@/lib/types'
import { MessageBubble } from './message-bubble'
import { CommandInvocationBubble } from './command-invocation-bubble'
import { SystemMessageBubble } from './system-message-bubble'
import { parseTimestamp } from '@/lib/format'
import {
  isSystemMessage,
  hasNoVisibleContent,
  parseCommandInvocation,
  extractTextFromContent,
} from '@/lib/message-utils'

interface ChatViewProps {
  messages: ChatMessage[]
  previewCount?: number
  highlightMessageId?: string
  showHidden?: boolean
  subagents?: SubagentSummary[]
}

function getTaskInvocations(message: ChatMessage): number {
  if (typeof message.message.content === 'string') return 0
  return message.message.content.filter(
    (block) => block.type === 'tool_use' && block.name === 'Task',
  ).length
}

function SubagentJumpBadge({ agent }: { agent: SubagentSummary }) {
  const handleClick = () => {
    const el = document.getElementById(`subagent-${agent.agentId}`)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 mt-1 mb-1 ml-4 px-3 py-1.5 text-xs text-accent hover:text-accent-hover bg-surface hover:bg-surface-elevated border border-edge-subtle hover:border-edge-hover rounded-lg transition-all"
    >
      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
        />
      </svg>
      <span className="font-mono">{agent.slug}</span>
      <span className="text-content-tertiary">·</span>
      <span className="text-content-tertiary truncate max-w-xs">{agent.firstMessage}</span>
      <svg
        className="w-3.5 h-3.5 flex-shrink-0 text-content-tertiary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

export function ChatView({
  messages,
  previewCount = 50,
  highlightMessageId,
  showHidden = false,
  subagents,
}: ChatViewProps) {
  const [showAll, setShowAll] = useState(!!highlightMessageId)
  const highlightRef = useRef<HTMLDivElement>(null)

  const filteredMessages = useMemo(() => {
    if (showHidden) return messages
    return messages.filter((m) => !isSystemMessage(m) && !hasNoVisibleContent(m))
  }, [messages, showHidden])

  const sortedMessages = [...filteredMessages].sort(
    (a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp),
  )
  const displayMessages = showAll ? sortedMessages : sortedMessages.slice(0, previewCount)
  const hasMore = sortedMessages.length > previewCount

  useEffect(() => {
    if (highlightMessageId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightMessageId])

  // Scan ALL messages (unfiltered) for Task invocations and map them to the nearest
  // preceding visible message, so badges appear even when system messages are hidden.
  const taskBadgeMap = new Map<string, SubagentSummary[]>()
  if (subagents && subagents.length > 0) {
    const allSorted = [...messages].sort(
      (a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp),
    )
    const visibleUuids = new Set(displayMessages.map((dm) => dm.uuid))
    let subagentIndex = 0

    for (let i = 0; i < allSorted.length; i++) {
      const msg = allSorted[i]
      const count = getTaskInvocations(msg)
      if (count === 0) continue

      // If visible, attach badge to this message directly.
      // Otherwise scan backwards for the nearest preceding visible message.
      let targetUuid: string | null = visibleUuids.has(msg.uuid) ? msg.uuid : null
      if (!targetUuid) {
        for (let j = i - 1; j >= 0; j--) {
          if (visibleUuids.has(allSorted[j].uuid)) {
            targetUuid = allSorted[j].uuid
            break
          }
        }
      }
      // Fallback: attach to first visible message after this one
      if (!targetUuid) {
        for (let j = i + 1; j < allSorted.length; j++) {
          if (visibleUuids.has(allSorted[j].uuid)) {
            targetUuid = allSorted[j].uuid
            break
          }
        }
      }

      if (targetUuid) {
        const badges = taskBadgeMap.get(targetUuid) ?? []
        for (let t = 0; t < count && subagentIndex < subagents.length; t++) {
          badges.push(subagents[subagentIndex++])
        }
        taskBadgeMap.set(targetUuid, badges)
      } else {
        subagentIndex += count
      }
    }
  }

  return (
    <div className="space-y-4">
      {displayMessages.map((message, i) => {
        const isHighlighted = highlightMessageId === message.uuid
        const taskBadges = taskBadgeMap.get(message.uuid) ?? []

        return (
          <div key={message.uuid}>
            <div
              ref={isHighlighted ? highlightRef : undefined}
              className={`${isHighlighted ? 'ring-2 ring-accent ring-offset-2 ring-offset-base rounded-2xl' : ''} animate-in stagger-${Math.min(i + 1, 10)}`}
            >
              {(() => {
                const text = extractTextFromContent(message.message.content)
                const cmd = parseCommandInvocation(text)
                if (cmd) {
                  return (
                    <CommandInvocationBubble
                      name={cmd.name}
                      args={cmd.args}
                      timestamp={message.timestamp}
                    />
                  )
                }
                if (showHidden && isSystemMessage(message)) {
                  return <SystemMessageBubble content={text} timestamp={message.timestamp} />
                }
                return <MessageBubble message={message} compact={!showAll} />
              })()}
            </div>
            {taskBadges.map((agent) => (
              <SubagentJumpBadge key={agent.agentId} agent={agent} />
            ))}
          </div>
        )
      })}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm text-accent hover:text-accent-hover bg-surface hover:bg-surface-elevated border border-edge-subtle hover:border-edge-hover rounded-xl transition-all"
          >
            {showAll ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
                Show preview only
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Show all {sortedMessages.length} messages
              </>
            )}
          </button>
        </div>
      )}

      {displayMessages.length === 0 && (
        <div className="text-center py-16 text-content-tertiary animate-fade">
          No messages in this session
        </div>
      )}
    </div>
  )
}
