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
            ? "bg-accent/15 border border-accent/20 text-content-primary rounded-br-md"
            : "bg-surface-elevated border border-edge-subtle text-content-primary rounded-bl-md"
        }`}
      >
        <div className={`text-[11px] mb-1.5 ${isUser ? "text-accent/60" : "text-content-tertiary"}`}>
          {isUser ? "You" : "Claude"} · {formatDateTime(message.timestamp)}
        </div>
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {expanded ? content : truncatedContent}
        </div>
        {needsTruncation && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`mt-2 text-xs font-medium ${
              isUser ? "text-accent/70 hover:text-accent" : "text-accent hover:text-accent-hover"
            } transition-colors`}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}
