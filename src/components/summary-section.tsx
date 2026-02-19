'use client'

import { useState, useEffect } from 'react'
import { AISummary } from '@/lib/types'

interface SummarySectionProps {
  type: 'session' | 'project'
  projectPath: string
  sessionId?: string
  messageCount: number
}

export function SummarySection({
  type,
  projectPath,
  sessionId,
  messageCount,
}: SummarySectionProps) {
  const [summary, setSummary] = useState<AISummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    async function fetchSummary() {
      try {
        const params = new URLSearchParams({ type, project: projectPath })
        if (sessionId) params.append('session', sessionId)

        const response = await fetch(`/api/summary?${params}`)
        const data = await response.json()
        setSummary(data.summary || null)
      } catch {
      } finally {
        setFetching(false)
      }
    }

    fetchSummary()
  }, [type, projectPath, sessionId])

  async function generateSummary() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, projectPath, sessionId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate summary')
      }

      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return null
  }

  const isStale = summary && summary.messageCount < messageCount

  return (
    <div className="p-4 bg-surface border border-edge-subtle rounded-xl">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h3 className="text-sm font-medium text-content-secondary flex items-center gap-2">
          <svg
            className="w-4 h-4 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          AI Summary
          {isStale && <span className="text-xs text-accent/60">(outdated)</span>}
        </h3>
        <button
          onClick={generateSummary}
          disabled={loading}
          className="px-3 py-1 text-xs font-medium text-accent hover:text-accent-hover hover:bg-accent/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : summary ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {error && <p className="text-sm text-danger mb-2">{error}</p>}

      {summary ? (
        <p className="text-sm text-content-secondary leading-relaxed">{summary.content}</p>
      ) : (
        !loading && (
          <p className="text-sm text-content-tertiary italic">
            No summary yet. Click &quot;Generate&quot; to create one.
          </p>
        )
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-content-tertiary">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Invoking Claude CLI...
        </div>
      )}
    </div>
  )
}
