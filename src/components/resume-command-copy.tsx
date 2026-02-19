'use client'

import { useState } from 'react'

interface ResumeCommandCopyProps {
  sessionId: string
}

export function ResumeCommandCopy({ sessionId }: ResumeCommandCopyProps) {
  const [skipPermissions, setSkipPermissions] = useState(true)
  const [copied, setCopied] = useState(false)

  const command = skipPermissions
    ? `claude --dangerously-skip-permissions --resume ${sessionId}`
    : `claude --resume ${sessionId}`

  async function handleCopy() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 bg-surface-elevated border border-edge-subtle rounded-lg font-mono text-xs text-content-secondary overflow-x-auto scrollbar-thin">
          <span className="text-accent select-none shrink-0">$</span>
          <span className="whitespace-nowrap">{command}</span>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 ${
            copied
              ? 'bg-success/15 text-success border border-success/20'
              : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20'
          }`}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-content-tertiary cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          checked={skipPermissions}
          onChange={(e) => setSkipPermissions(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-edge-hover bg-surface-elevated text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer"
        />
        Skip permissions
      </label>
    </div>
  )
}
