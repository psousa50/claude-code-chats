import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const CLAUDE_DIR = path.join(process.env.HOME || "", ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface DuplicateRequest {
  encodedPath: string;
  sessionId: string;
  keepLastN?: number;
}

interface ChatMessage {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  [key: string]: unknown;
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
    const { encodedPath, sessionId, keepLastN } = body;

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

    const newSessionId = crypto.randomUUID();
    const oldToNewUuid = new Map<string, string>();

    for (const msg of messagesToDuplicate) {
      oldToNewUuid.set(msg.uuid, crypto.randomUUID());
    }

    const duplicatedMessages = messagesToDuplicate.map((msg) => {
      const newUuid = oldToNewUuid.get(msg.uuid)!;
      const newParentUuid = msg.parentUuid
        ? oldToNewUuid.get(msg.parentUuid) ?? null
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
