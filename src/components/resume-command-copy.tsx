'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ResumeCommandCopyProps {
  sessionId: string
  encodedPath: string
  isArchived?: boolean
}

export function ResumeCommandCopy({ sessionId, encodedPath, isArchived }: ResumeCommandCopyProps) {
  const [skipPermissions, setSkipPermissions] = useState(true)
  const [copied, setCopied] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const command = skipPermissions
    ? `claude --dangerously-skip-permissions --resume ${sessionId}`
    : `claude --resume ${sessionId}`

  async function handleClick() {
    setError(null)

    if (isArchived) {
      setRestoring(true)
      try {
        const res = await fetch('/api/session/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encodedPath, sessionId }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? 'Failed to restore session')
          setRestoring(false)
          return
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restore session')
        setRestoring(false)
        return
      }
      setRestoring(false)
    }

    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    if (isArchived) {
      router.refresh()
    }
  }

  const buttonLabel = restoring
    ? 'Restoring…'
    : copied
      ? 'Copied'
      : isArchived
        ? 'Restore & copy'
        : 'Copy'

  return (
    <div className="space-y-2">
      {isArchived && (
        <p className="text-xs text-content-tertiary">
          This session is archived. Restoring copies it back so{' '}
          <span className="font-mono">claude --resume</span> can find it.
        </p>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 bg-surface-elevated border border-edge-subtle rounded-lg font-mono text-xs text-content-secondary overflow-x-auto scrollbar-thin">
          <span className="text-accent select-none shrink-0">$</span>
          <span className="whitespace-nowrap">{command}</span>
        </div>
        <button
          onClick={handleClick}
          disabled={restoring}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${
            copied
              ? 'bg-success/15 text-success border border-success/20'
              : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20'
          }`}
        >
          {copied ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
          {buttonLabel}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
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
