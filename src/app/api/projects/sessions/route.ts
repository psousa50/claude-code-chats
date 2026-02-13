import { NextRequest, NextResponse } from "next/server";
import { getSessionsSummary, decodeProjectPath } from "@/lib/chat-reader";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encodedPath = request.nextUrl.searchParams.get("path");
  if (!encodedPath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const sessions = getSessionsSummary(encodedPath);
  const decodedPath = decodeProjectPath(encodedPath);
  const parts = decodedPath.split("/").filter(Boolean);
  const projectName = parts[parts.length - 1] || decodedPath;

  return NextResponse.json({ sessions, projectName, decodedPath });
}
