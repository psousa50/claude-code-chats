"use client";

import { useState, useMemo } from "react";
import { ChatMessage } from "@/lib/types";
import { MessageBubble } from "./message-bubble";
import { parseTimestamp } from "@/lib/format";
import { isSystemMessage } from "@/lib/message-utils";

interface ChatViewProps {
  messages: ChatMessage[];
  previewCount?: number;
}

export function ChatView({ messages, previewCount = 6 }: ChatViewProps) {
  const [showAll, setShowAll] = useState(false);

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => !isSystemMessage(m));
  }, [messages]);

  const sortedMessages = [...filteredMessages].sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
  const displayMessages = showAll ? sortedMessages : sortedMessages.slice(0, previewCount);
  const hasMore = sortedMessages.length > previewCount;

  return (
    <div className="space-y-4">
      {displayMessages.map((message) => (
        <MessageBubble key={message.uuid} message={message} compact={!showAll} />
      ))}

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

      {displayMessages.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          No messages in this session
        </div>
      )}
    </div>
  );
}
