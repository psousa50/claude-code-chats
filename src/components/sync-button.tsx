"use client";

import { useState } from "react";

interface SyncResult {
  added: number;
  updated: number;
  removed: number;
}

export function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const response = await fetch("/api/sync", { method: "POST" });
      if (!response.ok) throw new Error("Sync failed");

      const data = await response.json();
      setResult(data.sync);

      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Resync database"
      >
        <svg
          className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>

      {result && (result.added > 0 || result.updated > 0 || result.removed > 0) && (
        <div className="text-xs text-neutral-500 whitespace-nowrap">
          {result.added > 0 && `+${result.added}`}
          {result.updated > 0 && ` ~${result.updated}`}
          {result.removed > 0 && ` -${result.removed}`}
        </div>
      )}
    </div>
  );
}
