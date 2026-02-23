'use client'

import { formatDateTime } from '@/lib/format'

interface CommandInvocationBubbleProps {
  name: string
  args: string
  timestamp: string | number
}

export function CommandInvocationBubble({ name, args, timestamp }: CommandInvocationBubbleProps) {
  return (
    <div className="flex justify-end py-1">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-edge-subtle text-xs">
        <svg
          className="w-3 h-3 text-accent shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l3 3-3 3m5 0h3"
          />
        </svg>
        <span className="text-accent font-mono font-medium">{name}</span>
        {args && <span className="text-content-secondary font-mono">{args}</span>}
        <span className="text-content-tertiary ml-1">{formatDateTime(timestamp)}</span>
      </div>
    </div>
  )
}
