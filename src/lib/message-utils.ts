import { ChatMessage, ContentBlock } from "./types";

export function extractTextFromContent(
  content: ChatMessage["message"]["content"]
): string {
  if (typeof content === "string") {
    return content;
  }
  const textBlock = content.find((block): block is ContentBlock & { type: "text" } => block.type === "text");
  if (textBlock) {
    return textBlock.text;
  }
  return "";
}

export function isSystemMessage(message: ChatMessage): boolean {
  if (message.isMeta) return true;

  const text = extractTextFromContent(message.message.content);
  if (text.startsWith("<command-name>")) return true;
  if (text.startsWith("<local-command-")) return true;
  if (text.startsWith("Caveat:")) return true;

  return false;
}
