"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlobalSearch } from "./global-search";
import { RenameProjectModal } from "./rename-project-modal";

interface ProjectHeaderProps {
  projectName: string;
  projectPath: string;
  encodedPath: string;
}

export function ProjectHeader({ projectName, projectPath, encodedPath }: ProjectHeaderProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
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
            <button
              onClick={() => setIsRenameOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 rounded-lg transition-colors flex-shrink-0"
            >
              Rename
            </button>
            <div className="flex-1 max-w-md">
              <GlobalSearch projectPath={encodedPath} />
            </div>
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
    </>
  );
}
