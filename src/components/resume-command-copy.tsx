"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";

interface ResumeCommandCopyProps {
  sessionId: string;
}

export function ResumeCommandCopy({ sessionId }: ResumeCommandCopyProps) {
  const [skipPermissions, setSkipPermissions] = useState(true);

  const command = skipPermissions
    ? `claude --dangerously-skip-permissions --resume ${sessionId}`
    : `claude --resume ${sessionId}`;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <code className="px-3 py-1.5 bg-neutral-800 rounded text-xs text-neutral-300 font-mono hidden sm:block">
          {sessionId}
        </code>
        <CopyButton text={command} label="Copy command" />
      </div>
      <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={skipPermissions}
          onChange={(e) => setSkipPermissions(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
        />
        <span>Skip permissions</span>
      </label>
    </div>
  );
}
