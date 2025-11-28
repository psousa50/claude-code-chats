import { NextRequest, NextResponse } from "next/server";
import { getSummary, saveSummary, getSessionSummaries } from "@/lib/search-db";
import { getSessionById, getProjectByPath } from "@/lib/chat-reader";
import { generateSessionSummary, generateProjectSummary } from "@/lib/claude-cli";
import { ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

function extractTextFromContent(content: ChatMessage["message"]["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  const textBlock = content.find((block) => block.type === "text");
  if (textBlock && "text" in textBlock) {
    return textBlock.text;
  }
  return "";
}

function isSystemMessage(message: ChatMessage): boolean {
  if (message.isMeta) return true;
  const text = extractTextFromContent(message.message.content);
  if (text.startsWith("<command-name>")) return true;
  if (text.startsWith("<local-command-")) return true;
  if (text.startsWith("Caveat:")) return true;
  if (text.startsWith("<system-reminder>")) return true;
  return false;
}

function formatConversationForSummary(messages: ChatMessage[]): string {
  const MAX_CHARS = 15000;
  const MAX_MSG_LENGTH = 500;

  const filteredMessages = messages.filter(
    (m) => !isSystemMessage(m) && extractTextFromContent(m.message.content).trim()
  );

  const userMessages = filteredMessages.filter((m) => m.type === "user");

  const sampled: ChatMessage[] = [];

  if (userMessages.length <= 20) {
    sampled.push(...userMessages);
  } else {
    sampled.push(...userMessages.slice(0, 5));
    const middleStart = Math.floor(userMessages.length / 2) - 2;
    sampled.push(...userMessages.slice(middleStart, middleStart + 5));
    sampled.push(...userMessages.slice(-5));
  }

  let output = "";
  for (const message of sampled) {
    const text = extractTextFromContent(message.message.content);
    const truncatedText = text.length > MAX_MSG_LENGTH ? text.slice(0, MAX_MSG_LENGTH) + "..." : text;
    const line = `- ${truncatedText}\n`;

    if (output.length + line.length > MAX_CHARS) {
      break;
    }
    output += line;
  }

  return output;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") as "session" | "project" | null;
  const projectPath = searchParams.get("project");
  const sessionId = searchParams.get("session");

  if (!type || !projectPath) {
    return NextResponse.json(
      { error: "Missing required parameters: type and project" },
      { status: 400 }
    );
  }

  if (type === "session" && !sessionId) {
    return NextResponse.json(
      { error: "Missing required parameter: session" },
      { status: 400 }
    );
  }

  try {
    const targetId = type === "session" ? sessionId! : projectPath;
    const summary = getSummary(type, targetId, projectPath);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Get summary error:", error);
    return NextResponse.json(
      { error: "Failed to get summary", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, projectPath, sessionId } = body as {
    type: "session" | "project";
    projectPath: string;
    sessionId?: string;
  };

  if (!type || !projectPath) {
    return NextResponse.json(
      { error: "Missing required parameters: type and projectPath" },
      { status: 400 }
    );
  }

  if (type === "session" && !sessionId) {
    return NextResponse.json(
      { error: "Missing required parameter: sessionId" },
      { status: 400 }
    );
  }

  try {
    if (type === "session") {
      const session = getSessionById(projectPath, sessionId!);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const conversationText = formatConversationForSummary(session.messages);
      const result = await generateSessionSummary(conversationText);

      if (!result.success) {
        return NextResponse.json(
          { error: "Failed to generate summary", details: result.error },
          { status: 500 }
        );
      }

      const summary = saveSummary({
        type: "session",
        targetId: sessionId!,
        projectPath,
        content: result.output,
        createdAt: Date.now(),
        messageCount: session.messageCount,
      });

      return NextResponse.json({ summary });
    }

    const project = getProjectByPath(projectPath);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const sessionSummaries = getSessionSummaries(projectPath);
    if (sessionSummaries.length === 0) {
      return NextResponse.json(
        { error: "No session summaries found. Generate session summaries first." },
        { status: 400 }
      );
    }

    const summaryTexts = sessionSummaries.map((s) => s.content);
    const result = await generateProjectSummary(summaryTexts);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to generate project summary", details: result.error },
        { status: 500 }
      );
    }

    const summary = saveSummary({
      type: "project",
      targetId: projectPath,
      projectPath,
      content: result.output,
      createdAt: Date.now(),
      messageCount: project.totalMessages,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Generate summary error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
