"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlobalSearch } from "./global-search";
import { RenameProjectModal } from "./rename-project-modal";
import { MemoryViewer } from "./memory-viewer";
import { SyncButton } from "./sync-button";

interface ProjectHeaderProps {
  projectName: string;
  projectPath: string;
  encodedPath: string;
  hasMemory: boolean;
}

export function ProjectHeader({ projectName, projectPath, encodedPath, hasMemory }: ProjectHeaderProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const router = useRouter();

  function handleRenameSuccess(newEncodedPath: string) {
    setIsRenameOpen(false);
    router.replace(`/project/${newEncodedPath}`);
  }

  return (
    <>
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 -ml-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0 hidden sm:block">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-neutral-100 truncate">{projectName}</h1>
              </div>
              <p className="text-xs text-neutral-500 truncate">{projectPath}</p>
            </div>
            {hasMemory && (
              <button
                onClick={() => setShowMemory(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 rounded-lg transition-colors flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Memory
              </button>
            )}
            <button
              onClick={() => setIsRenameOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 rounded-lg transition-colors flex-shrink-0"
            >
              Rename
            </button>
            <div className="flex-1 max-w-md">
              <GlobalSearch projectPath={encodedPath} />
            </div>
            <SyncButton />
          </div>
        </div>
      </header>

      <RenameProjectModal
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        onSuccess={handleRenameSuccess}
        currentPath={projectPath}
        encodedPath={encodedPath}
      />

      {showMemory && (
        <MemoryViewer
          encodedPath={encodedPath}
          onClose={() => setShowMemory(false)}
        />
      )}
    </>
  );
}
