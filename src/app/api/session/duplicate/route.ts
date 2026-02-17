import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { syncIndex } from "@/lib/search-db";

export const dynamic = "force-dynamic";

const CLAUDE_DIR = path.join(process.env.HOME || "", ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface DuplicateRequest {
  encodedPath: string;
  sessionId: string;
  keepLastN?: number;
  stripToolResults?: boolean;
}

interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface ChatMessage {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  type?: string;
  isMeta?: boolean;
  message?: {
    content: string | ContentBlock[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function extractTextFromContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  const textBlock = content.find((block) => block.type === "text");
  return textBlock?.text || "";
}

function isSystemMessage(message: ChatMessage): boolean {
  if (message.isMeta) return true;
  if (!message.message?.content) return false;
  const text = extractTextFromContent(message.message.content);
  if (text.startsWith("<command-name>")) return true;
  if (text.startsWith("<local-command-")) return true;
  if (text.startsWith("Caveat:")) return true;
  return false;
}

function stripToolResultsFromMessage(message: ChatMessage): ChatMessage {
  if (!message.message?.content || typeof message.message.content === "string") {
    return message;
  }
  const filteredContent = message.message.content.filter(
    (block) => block.type !== "tool_result"
  );
  if (filteredContent.length === message.message.content.length) {
    return message;
  }
  return {
    ...message,
    message: {
      ...message.message,
      content: filteredContent,
    },
  };
}

function hasNoVisibleContent(message: ChatMessage): boolean {
  const content = message.message?.content;
  if (!content) return true;
  if (typeof content === "string") return content.trim().length === 0;
  if (content.length === 0) return true;
  return !content.some((block) => block.type === "text" && block.text?.trim());
}

function parseJsonlFile(filePath: string): ChatMessage[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());
  return lines
    .map((line) => {
      try {
        return JSON.parse(line) as ChatMessage;
      } catch {
        return null;
      }
    })
    .filter((msg): msg is ChatMessage => msg !== null);
}

function writeJsonlFile(filePath: string, messages: ChatMessage[]): void {
  const content = messages.map((msg) => JSON.stringify(msg)).join("\n");
  fs.writeFileSync(filePath, content + "\n", "utf-8");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DuplicateRequest;
    const { encodedPath, sessionId, keepLastN, stripToolResults } = body;

    if (!encodedPath || !sessionId) {
      return NextResponse.json(
        { error: "Missing required parameters: encodedPath and sessionId" },
        { status: 400 }
      );
    }

    if (keepLastN !== undefined && (keepLastN <= 0 || !Number.isInteger(keepLastN))) {
      return NextResponse.json(
        { error: "keepLastN must be a positive integer" },
        { status: 400 }
      );
    }

    const projectDir = path.join(PROJECTS_DIR, encodedPath);
    const sourceFile = path.join(projectDir, `${sessionId}.jsonl`);

    if (!fs.existsSync(projectDir)) {
      return NextResponse.json(
        { error: "Project not found", code: "PROJECT_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!fs.existsSync(sourceFile)) {
      return NextResponse.json(
        { error: "Session not found", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const messages = parseJsonlFile(sourceFile);

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Session has no messages", code: "EMPTY_SESSION" },
        { status: 400 }
      );
    }

    let messagesToDuplicate = messages;
    if (keepLastN !== undefined && keepLastN < messages.length) {
      messagesToDuplicate = messages.slice(-keepLastN);
    }

    if (stripToolResults) {
      messagesToDuplicate = messagesToDuplicate
        .filter((msg) => !isSystemMessage(msg))
        .map(stripToolResultsFromMessage)
        .filter((msg) => !hasNoVisibleContent(msg));
    }

    const newSessionId = crypto.randomUUID();

    const originalParentMap = new Map<string, string | null>();
    for (const msg of messages) {
      originalParentMap.set(msg.uuid, msg.parentUuid);
    }

    const survivingUuids = new Set(messagesToDuplicate.map((m) => m.uuid));

    function findSurvivingParent(uuid: string | null): string | null {
      let current = uuid;
      while (current !== null) {
        if (survivingUuids.has(current)) return current;
        current = originalParentMap.get(current) ?? null;
      }
      return null;
    }

    const oldToNewUuid = new Map<string, string>();
    for (const msg of messagesToDuplicate) {
      oldToNewUuid.set(msg.uuid, crypto.randomUUID());
    }

    const duplicatedMessages = messagesToDuplicate.map((msg) => {
      const newUuid = oldToNewUuid.get(msg.uuid)!;
      const survivingParent = findSurvivingParent(msg.parentUuid);
      const newParentUuid = survivingParent
        ? oldToNewUuid.get(survivingParent) ?? null
        : null;

      return {
        ...msg,
        uuid: newUuid,
        parentUuid: newParentUuid,
        sessionId: newSessionId,
      };
    });

    const destFile = path.join(projectDir, `${newSessionId}.jsonl`);
    writeJsonlFile(destFile, duplicatedMessages);
    syncIndex();

    return NextResponse.json({
      success: true,
      newSessionId,
      messageCount: duplicatedMessages.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to duplicate session", details: message },
      { status: 500 }
    );
  }
}
