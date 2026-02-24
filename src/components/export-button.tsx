'use client'

interface ExportButtonProps {
  encodedPath: string
  sessionId: string
  agentId?: string
}

export function ExportButton({ encodedPath, sessionId, agentId }: ExportButtonProps) {
  function handleExport() {
    const params = new URLSearchParams({ encodedPath, sessionId })
    if (agentId) params.set('agentId', agentId)
    window.location.href = `/api/session/export?${params.toString()}`
  }

  return (
    <button
      onClick={handleExport}
      className="px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-surface-elevated border border-edge-subtle rounded-lg transition-all flex items-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Export
    </button>
  )
}
