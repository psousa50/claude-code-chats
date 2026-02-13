"use client";

import { useEffect, useState, useRef } from "react";

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
  const backdropRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-200">Project Memory</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!files && !error && <p className="text-sm text-neutral-500">Loading...</p>}
          {files?.map((file) => (
            <div key={file.name}>
              {files.length > 1 && (
                <h3 className="text-xs font-medium text-amber-500/80 mb-2">{file.name}</h3>
              )}
              <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed">
                {file.content}
              </pre>
            </div>
          ))}
          {files?.length === 0 && (
            <p className="text-sm text-neutral-500">No memory files found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
