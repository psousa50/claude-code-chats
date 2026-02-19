'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface DuplicateSessionButtonProps {
  encodedPath: string
  sessionId: string
  totalMessageCount: number
  strippedMessageCount: number
}

export function DuplicateSessionButton({
  encodedPath,
  sessionId,
  totalMessageCount,
  strippedMessageCount,
}: DuplicateSessionButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [keepLastN, setKeepLastN] = useState<string>('')
  const [stripToolResults, setStripToolResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setKeepLastN('')
      setStripToolResults(false)
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !loading) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, loading])

  const parsedKeepLastN = keepLastN ? parseInt(keepLastN, 10) : undefined
  const isValidKeepLastN = !keepLastN || (parsedKeepLastN && parsedKeepLastN > 0)

  const baseCount = stripToolResults ? strippedMessageCount : totalMessageCount
  const resultingMessageCount = parsedKeepLastN ? Math.min(parsedKeepLastN, baseCount) : baseCount
  const reductionPercent =
    totalMessageCount > 0 ? Math.round((1 - resultingMessageCount / totalMessageCount) * 100) : 0

  async function handleDuplicate() {
    if (!isValidKeepLastN) {
      setError('Please enter a valid positive number.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/session/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encodedPath,
          sessionId,
          keepLastN: parsedKeepLastN,
          stripToolResults,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate session')
      }

      router.push(`/project/${encodedPath}/session/${data.newSessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 text-sm text-accent hover:text-accent-hover hover:bg-accent/10 border border-accent/20 rounded-lg transition-all flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Duplicate
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade"
            onClick={loading ? undefined : () => setIsOpen(false)}
          />
          <div className="relative bg-surface-elevated border border-edge rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-modal">
            <h2 className="text-lg font-medium text-content-primary mb-4">Duplicate Session</h2>

            <div className="mb-4">
              <label htmlFor="keepLastN" className="block text-sm text-content-secondary mb-2">
                Keep last N messages (optional)
              </label>
              <input
                ref={inputRef}
                id="keepLastN"
                type="number"
                min="1"
                value={keepLastN}
                onChange={(e) => setKeepLastN(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2.5 bg-surface border border-edge rounded-xl text-content-primary placeholder-content-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50 transition-all"
                placeholder={`Leave empty for all ${totalMessageCount} messages`}
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={stripToolResults}
                  onChange={(e) => setStripToolResults(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 rounded border-edge-hover bg-surface text-accent focus:ring-accent focus:ring-offset-0 disabled:opacity-50"
                />
                Strip tool results & system messages
              </label>
            </div>

            <div className="text-sm text-content-secondary mb-4 p-3 bg-surface rounded-xl border border-edge-subtle">
              <div className="flex justify-between">
                <span>Original</span>
                <span className="text-content-primary">{totalMessageCount} messages</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Result</span>
                <span className="text-content-primary">{resultingMessageCount} messages</span>
              </div>
              {reductionPercent > 0 && (
                <div className="flex justify-between mt-1 text-accent">
                  <span>Reduction</span>
                  <span>{reductionPercent}%</span>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-danger mb-4">{error}</p>}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicate}
                disabled={loading || !isValidKeepLastN}
                className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && (
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
                )}
                {loading ? 'Duplicating...' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
