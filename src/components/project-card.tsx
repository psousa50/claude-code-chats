'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ProjectSummary } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'
import { MemoryViewer } from './memory-viewer'

interface ProjectCardProps {
  project: ProjectSummary
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [showMemory, setShowMemory] = useState(false)

  return (
    <>
      <Link
        href={`/project/${project.encodedPath}`}
        className="block p-4 bg-surface border border-edge-subtle rounded-xl hover:border-edge-hover hover:bg-surface-elevated transition-all duration-300 group hover:shadow-lg hover:shadow-accent/[0.04]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-content-primary truncate group-hover:text-accent transition-colors">
              {project.name}
            </h3>
            <p className="text-xs text-content-tertiary truncate mt-0.5 font-mono">
              {project.path}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {project.hasMemory && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowMemory(true)
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium tracking-wide rounded bg-accent/10 text-accent/80 hover:bg-accent/20 hover:text-accent transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                MEMORY
              </button>
            )}
            <div className="text-content-tertiary group-hover:text-accent transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-content-tertiary">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {project.sessionCount} session{project.sessionCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            {project.totalMessages} messages
          </span>
          <span className="flex items-center gap-1.5 ml-auto">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {formatRelativeTime(project.lastActivity)}
          </span>
        </div>
      </Link>

      {showMemory && (
        <MemoryViewer encodedPath={project.encodedPath} onClose={() => setShowMemory(false)} />
      )}
    </>
  )
}
