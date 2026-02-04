"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/types";
import { MessageBubble } from "./message-bubble";
import { parseTimestamp } from "@/lib/format";
import { isSystemMessage, hasNoVisibleContent } from "@/lib/message-utils";

interface ChatViewProps {
  messages: ChatMessage[];
  previewCount?: number;
  highlightMessageId?: string;
}

export function ChatView({ messages, previewCount = 6, highlightMessageId }: ChatViewProps) {
  const [showAll, setShowAll] = useState(!!highlightMessageId);
  const [showHidden, setShowHidden] = useState(false);
  const highlightRef = useRef<HTMLDivElement>(null);

  const filteredMessages = useMemo(() => {
    if (showHidden) return messages;
    return messages.filter((m) => !isSystemMessage(m) && !hasNoVisibleContent(m));
  }, [messages, showHidden]);

  const sortedMessages = [...filteredMessages].sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
  const displayMessages = showAll ? sortedMessages : sortedMessages.slice(0, previewCount);
  const hasMore = sortedMessages.length > previewCount;

  useEffect(() => {
    if (highlightMessageId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightMessageId]);

  return (
    <div className="space-y-4">
      {displayMessages.map((message) => {
        const isHighlighted = highlightMessageId === message.uuid;
        return (
          <div
            key={message.uuid}
            ref={isHighlighted ? highlightRef : undefined}
            className={isHighlighted ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-neutral-950 rounded-lg" : ""}
          >
            <MessageBubble message={message} compact={!showAll} />
          </div>
        );
      })}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-amber-500 hover:text-amber-400 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors"
          >
            {showAll ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Show preview only
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Show all {sortedMessages.length} messages
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
          />
          Show system messages
        </label>
      </div>

      {displayMessages.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          No messages in this session
        </div>
      )}
    </div>
  );
}
