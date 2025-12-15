"use client";

import { useState, useEffect, useRef } from "react";

interface RenameProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEncodedPath: string) => void;
  currentPath: string;
  encodedPath: string;
}

function extractFolderName(projectPath: string): string {
  const parts = projectPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

export function RenameProjectModal({
  isOpen,
  onClose,
  onSuccess,
  currentPath,
  encodedPath,
}: RenameProjectModalProps) {
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewName(extractFolderName(currentPath));
      setError(null);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isOpen, currentPath]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!newName.trim()) {
      setError("Name cannot be empty.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/project/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encodedPath, newName: newName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to rename project");
      }

      onSuccess(data.newEncodedPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">Rename Project</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="projectName" className="block text-sm text-neutral-400 mb-2">
              New folder name
            </label>
            <input
              ref={inputRef}
              id="projectName"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              placeholder="Enter new name"
              autoComplete="off"
            />
          </div>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newName.trim()}
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
              {loading ? "Renaming..." : "Rename"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
