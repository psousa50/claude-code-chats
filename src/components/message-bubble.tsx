"use client";

import { useState } from "react";
import { ChatMessage, ContentBlock } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

interface MessageBubbleProps {
  message: ChatMessage;
  compact?: boolean;
}

function renderContent(content: ContentBlock[] | string, expanded: boolean): string {
  if (typeof content === "string") {
    return content;
  }

  const parts: string[] = [];

  for (const block of content) {
    if (block.type === "text") {
      parts.push(block.text);
    } else if (block.type === "tool_use") {
      parts.push(`[Tool: ${block.name}]`);
    } else if (block.type === "tool_result") {
      if (expanded) {
        const resultText = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
        parts.push(`[Tool Result: ${resultText.slice(0, 500)}${resultText.length > 500 ? "..." : ""}]`);
      }
    }
  }

  return parts.join("\n\n");
}

export function MessageBubble({ message, compact = false }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.type === "user";

  const content = renderContent(message.message.content, expanded);
  const truncatedContent = compact && !expanded && content.length > 300
    ? content.slice(0, 300) + "..."
    : content;

  const needsTruncation = compact && content.length > 300;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-amber-600 text-white rounded-br-md"
            : "bg-neutral-800 text-neutral-100 rounded-bl-md"
        }`}
      >
        <div className="text-xs opacity-60 mb-1.5">
          {isUser ? "You" : "Claude"} · {formatDateTime(message.timestamp)}
        </div>
        <div className="text-sm whitespace-pre-wrap break-words">
          {expanded ? content : truncatedContent}
        </div>
        {needsTruncation && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`mt-2 text-xs font-medium ${
              isUser ? "text-amber-200 hover:text-white" : "text-amber-500 hover:text-amber-400"
            }`}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}
