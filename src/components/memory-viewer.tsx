"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface MemoryFile {
  name: string;
  content: string;
}

interface MemoryViewerProps {
  encodedPath: string;
  onClose: () => void;
}

export function MemoryViewer({ encodedPath, onClose }: MemoryViewerProps) {
  const [files, setFiles] = useState<MemoryFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/memory?path=${encodeURIComponent(encodedPath)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => setFiles(data.files))
      .catch(() => setError("Failed to load memory"));
  }, [encodedPath]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade"
        onClick={onClose}
      />
      <div className="relative bg-surface-elevated border border-edge rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl mx-4 animate-modal">
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-subtle">
          <h2 className="text-sm font-medium text-content-primary">Project Memory</h2>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 text-content-tertiary hover:text-content-primary hover:bg-surface rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6 scrollbar-thin">
          {error && <p className="text-sm text-danger">{error}</p>}
          {!files && !error && <p className="text-sm text-content-tertiary">Loading...</p>}
          {files?.map((file) => (
            <div key={file.name}>
              {files.length > 1 && (
                <h3 className="text-xs font-medium text-accent/70 mb-2 font-mono">{file.name}</h3>
              )}
              <pre className="text-sm text-content-secondary whitespace-pre-wrap font-mono leading-relaxed">
                {file.content}
              </pre>
            </div>
          ))}
          {files?.length === 0 && (
            <p className="text-sm text-content-tertiary">No memory files found.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
