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
  showHidden?: boolean;
}

export function ChatView({ messages, previewCount = 6, highlightMessageId, showHidden = false }: ChatViewProps) {
  const [showAll, setShowAll] = useState(!!highlightMessageId);
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
      {displayMessages.map((message, i) => {
        const isHighlighted = highlightMessageId === message.uuid;
        return (
          <div
            key={message.uuid}
            ref={isHighlighted ? highlightRef : undefined}
            className={`${isHighlighted ? "ring-2 ring-accent ring-offset-2 ring-offset-base rounded-2xl" : ""} animate-in stagger-${Math.min(i + 1, 10)}`}
          >
            <MessageBubble message={message} compact={!showAll} />
          </div>
        );
      })}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm text-accent hover:text-accent-hover bg-surface hover:bg-surface-elevated border border-edge-subtle hover:border-edge-hover rounded-xl transition-all"
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

      {displayMessages.length === 0 && (
        <div className="text-center py-16 text-content-tertiary animate-fade">
          No messages in this session
        </div>
      )}
    </div>
  );
}
