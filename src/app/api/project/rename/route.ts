import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { decodeProjectPath, encodeProjectPath } from "@/lib/chat-reader";
import { renameProjectInIndex } from "@/lib/search-db";

const CLAUDE_DIR = path.join(process.env.HOME || "", ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

export const dynamic = "force-dynamic";

interface RenameRequest {
  encodedPath: string;
  newName: string;
}

function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: "Name cannot be empty." };
  }

  const trimmed = name.trim();

  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return { valid: false, error: "Name cannot contain slashes." };
  }

  if (trimmed === "." || trimmed === "..") {
    return { valid: false, error: "Invalid name." };
  }

  if (trimmed.length > 255) {
    return { valid: false, error: "Name is too long." };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RenameRequest;
    const { encodedPath, newName } = body;

    if (!encodedPath || !newName) {
      return NextResponse.json(
        { error: "Missing required parameters: encodedPath and newName" },
        { status: 400 }
      );
    }

    const validation = validateName(newName);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, code: "INVALID_NAME" },
        { status: 400 }
      );
    }

    const trimmedName = newName.trim();
    const oldProjectPath = decodeProjectPath(encodedPath);
    const oldClaudePath = path.join(PROJECTS_DIR, encodedPath);

    const parentDir = path.dirname(oldProjectPath);
    const newProjectPath = path.join(parentDir, trimmedName);
    const newEncodedPath = encodeProjectPath(newProjectPath);
    const newClaudePath = path.join(PROJECTS_DIR, newEncodedPath);

    if (oldProjectPath === newProjectPath) {
      return NextResponse.json({
        success: true,
        newEncodedPath: encodedPath,
        newPath: oldProjectPath,
      });
    }

    if (!fs.existsSync(oldProjectPath)) {
      return NextResponse.json(
        { error: "The project folder no longer exists at the expected location.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!fs.existsSync(oldClaudePath)) {
      return NextResponse.json(
        { error: "Could not find the Claude project data folder.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (fs.existsSync(newProjectPath)) {
      return NextResponse.json(
        { error: "A folder with this name already exists.", code: "ALREADY_EXISTS" },
        { status: 409 }
      );
    }

    if (fs.existsSync(newClaudePath)) {
      return NextResponse.json(
        { error: "A project with this name already exists in Claude data.", code: "ALREADY_EXISTS" },
        { status: 409 }
      );
    }

    let projectRenamed = false;
    let claudeRenamed = false;

    try {
      fs.renameSync(oldProjectPath, newProjectPath);
      projectRenamed = true;

      fs.renameSync(oldClaudePath, newClaudePath);
      claudeRenamed = true;

      renameProjectInIndex(encodedPath, newEncodedPath);

      return NextResponse.json({
        success: true,
        newEncodedPath,
        newPath: newProjectPath,
      });
    } catch (error) {
      if (projectRenamed && !claudeRenamed) {
        try {
          fs.renameSync(newProjectPath, oldProjectPath);
        } catch {
          // Ignore rollback error
        }
      }

      if (projectRenamed && claudeRenamed) {
        try {
          fs.renameSync(newClaudePath, oldClaudePath);
          fs.renameSync(newProjectPath, oldProjectPath);
        } catch {
          // Ignore rollback error
        }
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("EACCES") || errorMessage.includes("permission")) {
        return NextResponse.json(
          { error: "Permission denied. Check folder permissions.", code: "PERMISSION_DENIED" },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `Failed to rename: ${errorMessage}`, code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Rename project error:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
