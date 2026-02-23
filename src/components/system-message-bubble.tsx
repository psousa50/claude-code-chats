'use client'

import { formatDateTime } from '@/lib/format'

interface SystemMessageBubbleProps {
  content: string
  timestamp: string | number
}

function parseSystemContent(text: string): { tag: string; body: string } | null {
  const match = text.match(/^<([\w-]+)>([\s\S]*?)<\/[\w-]+>/)
  if (!match) return null
  return { tag: match[1], body: match[2].trim() }
}

function formatTag(tag: string): string {
  return tag.replace(/^local-command-/, '').replace(/-/g, ' ')
}

export function SystemMessageBubble({ content, timestamp }: SystemMessageBubbleProps) {
  const parsed = parseSystemContent(content)
  const label = parsed ? formatTag(parsed.tag) : 'system'
  const body = parsed?.body ?? ''
  const truncated = body.length > 80 ? body.slice(0, 80) + '…' : body

  return (
    <div className="flex justify-end py-1">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-edge-subtle text-xs text-content-tertiary max-w-[85%]">
        <span className="font-medium shrink-0">{label}</span>
        {truncated && (
          <>
            <span className="opacity-40">·</span>
            <span className="font-mono truncate">{truncated}</span>
          </>
        )}
        <span className="opacity-40 shrink-0 ml-1">{formatDateTime(timestamp)}</span>
      </div>
    </div>
  )
}
