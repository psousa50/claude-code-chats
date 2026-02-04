import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const CLAUDE_DIR = path.join(process.env.HOME || "", ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface DeleteRequest {
  encodedPath: string;
  sessionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeleteRequest;
    const { encodedPath, sessionId } = body;

    if (!encodedPath || !sessionId) {
      return NextResponse.json(
        { error: "Missing required parameters: encodedPath and sessionId" },
        { status: 400 }
      );
    }

    const projectDir = path.join(PROJECTS_DIR, encodedPath);
    const sessionFile = path.join(projectDir, `${sessionId}.jsonl`);

    if (!fs.existsSync(projectDir)) {
      return NextResponse.json(
        { error: "Project not found", code: "PROJECT_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!fs.existsSync(sessionFile)) {
      return NextResponse.json(
        { error: "Session not found", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    fs.unlinkSync(sessionFile);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete session", details: message },
      { status: 500 }
    );
  }
}
