import fs from "fs";
import path from "path";
import { ChatMessage, ChatSession, Project, ProjectSummary, SessionSummary } from "./types";

const CLAUDE_DIR = path.join(process.env.HOME || "", ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

function decodeProjectPath(encodedPath: string): string {
  return encodedPath.replace(/-/g, "/");
}

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

function extractTextFromContent(
  content: ChatMessage["message"]["content"]
): string {
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

  return false;
}

function parseTimestamp(timestamp: string | number): number {
  if (typeof timestamp === "number") {
    return timestamp;
  }
  const parsed = Date.parse(timestamp);
  return isNaN(parsed) ? 0 : parsed;
}

function parseJsonlFile(filePath: string): ChatMessage[] {
  try {
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
      .filter((msg): msg is ChatMessage => msg !== null)
      .filter((msg) => msg.type === "user" || msg.type === "assistant");
  } catch {
    return [];
  }
}

function getSessionsForProject(projectDir: string): ChatSession[] {
  try {
    const files = fs.readdirSync(projectDir);
    const jsonlFiles = files.filter((f) =>
      f.endsWith(".jsonl") && !f.startsWith("agent-")
    );
    const encodedPath = path.basename(projectDir);

    return jsonlFiles
      .map((file) => {
        const filePath = path.join(projectDir, file);
        const messages = parseJsonlFile(filePath);

        if (messages.length === 0) {
          return null;
        }

        const sessionId = file.replace(".jsonl", "");
        const firstUserMessage = messages.find((m) => m.type === "user" && !isSystemMessage(m));
        const firstMessageText = firstUserMessage
          ? extractTextFromContent(firstUserMessage.message.content)
          : "No messages";

        const timestamps = messages
          .map((m) => parseTimestamp(m.timestamp))
          .filter((t) => t > 0);
        const lastActivity =
          timestamps.length > 0 ? Math.max(...timestamps) : 0;

        const projectPath = decodeProjectPath(encodedPath);

        return {
          id: sessionId,
          projectPath,
          projectName: extractProjectName(projectPath),
          encodedPath,
          messages,
          firstMessage: firstMessageText.slice(0, 500),
          lastActivity,
          messageCount: messages.length,
        };
      })
      .filter((session): session is ChatSession => session !== null)
      .sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

export function getAllProjects(): Project[] {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      return [];
    }

    const projectDirs = fs.readdirSync(PROJECTS_DIR);

    return projectDirs
      .map((dir) => {
        const projectDirPath = path.join(PROJECTS_DIR, dir);
        const stat = fs.statSync(projectDirPath);

        if (!stat.isDirectory()) {
          return null;
        }

        const sessions = getSessionsForProject(projectDirPath);

        if (sessions.length === 0) {
          return null;
        }

        const projectPath = decodeProjectPath(dir);
        const totalMessages = sessions.reduce(
          (sum, s) => sum + s.messageCount,
          0
        );
        const lastActivity = Math.max(...sessions.map((s) => s.lastActivity));

        return {
          path: projectPath,
          name: extractProjectName(projectPath),
          encodedPath: dir,
          sessions,
          totalMessages,
          lastActivity,
        };
      })
      .filter((project): project is Project => project !== null)
      .sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

export function getProjectByPath(encodedPath: string): Project | null {
  const projectDirPath = path.join(PROJECTS_DIR, encodedPath);

  try {
    if (!fs.existsSync(projectDirPath)) {
      return null;
    }

    const sessions = getSessionsForProject(projectDirPath);

    if (sessions.length === 0) {
      return null;
    }

    const projectPath = decodeProjectPath(encodedPath);
    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
    const lastActivity = Math.max(...sessions.map((s) => s.lastActivity));

    return {
      path: projectPath,
      name: extractProjectName(projectPath),
      encodedPath,
      sessions,
      totalMessages,
      lastActivity,
    };
  } catch {
    return null;
  }
}

function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

function getValidSessionFiles(projectDir: string): string[] {
  try {
    const files = fs.readdirSync(projectDir);
    return files.filter((f) => f.endsWith(".jsonl") && !f.startsWith("agent-"));
  } catch {
    return [];
  }
}

export function getProjectsSummary(): ProjectSummary[] {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      return [];
    }

    const projectDirs = fs.readdirSync(PROJECTS_DIR);

    return projectDirs
      .map((dir) => {
        const projectDirPath = path.join(PROJECTS_DIR, dir);
        const stat = fs.statSync(projectDirPath);

        if (!stat.isDirectory()) {
          return null;
        }

        const sessionFiles = getValidSessionFiles(projectDirPath);
        if (sessionFiles.length === 0) {
          return null;
        }

        let totalMessages = 0;
        let lastActivity = 0;

        for (const file of sessionFiles) {
          const filePath = path.join(projectDirPath, file);
          const fileStat = fs.statSync(filePath);

          if (fileStat.size === 0) continue;

          totalMessages += countLines(filePath);
          const mtime = fileStat.mtime.getTime();
          if (mtime > lastActivity) {
            lastActivity = mtime;
          }
        }

        if (totalMessages === 0) {
          return null;
        }

        const projectPath = decodeProjectPath(dir);

        return {
          path: projectPath,
          name: extractProjectName(projectPath),
          encodedPath: dir,
          sessionCount: sessionFiles.length,
          totalMessages,
          lastActivity,
        };
      })
      .filter((project): project is ProjectSummary => project !== null)
      .sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

function parseFirstLines(filePath: string, maxLines: number): ChatMessage[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim()).slice(0, maxLines);
    return lines
      .map((line) => {
        try {
          return JSON.parse(line) as ChatMessage;
        } catch {
          return null;
        }
      })
      .filter((msg): msg is ChatMessage => msg !== null)
      .filter((msg) => msg.type === "user" || msg.type === "assistant");
  } catch {
    return [];
  }
}

export function getSessionsSummary(encodedPath: string): SessionSummary[] {
  const projectDirPath = path.join(PROJECTS_DIR, encodedPath);

  try {
    if (!fs.existsSync(projectDirPath)) {
      return [];
    }

    const sessionFiles = getValidSessionFiles(projectDirPath);

    return sessionFiles
      .map((file) => {
        const filePath = path.join(projectDirPath, file);
        const fileStat = fs.statSync(filePath);

        if (fileStat.size === 0) {
          return null;
        }

        const sessionId = file.replace(".jsonl", "");
        const firstMessages = parseFirstLines(filePath, 100);

        if (firstMessages.length === 0) {
          return null;
        }

        const firstUserMessage = firstMessages.find((m) => m.type === "user" && !isSystemMessage(m));

        if (!firstUserMessage) {
          return null;
        }

        const firstMessageText = extractTextFromContent(firstUserMessage.message.content);

        return {
          id: sessionId,
          encodedPath,
          firstMessage: firstMessageText.slice(0, 500),
          messageCount: firstMessages.length,
          lastActivity: fileStat.mtime.getTime(),
        };
      })
      .filter((session): session is SessionSummary => session !== null)
      .sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

export function getSessionById(
  encodedProjectPath: string,
  sessionId: string
): ChatSession | null {
  const projectDirPath = path.join(PROJECTS_DIR, encodedProjectPath);
  const sessionFilePath = path.join(projectDirPath, `${sessionId}.jsonl`);

  try {
    if (!fs.existsSync(sessionFilePath)) {
      return null;
    }

    const messages = parseJsonlFile(sessionFilePath);

    if (messages.length === 0) {
      return null;
    }

    const firstUserMessage = messages.find((m) => m.type === "user" && !isSystemMessage(m));
    const firstMessageText = firstUserMessage
      ? extractTextFromContent(firstUserMessage.message.content)
      : "No messages";

    const timestamps = messages.map((m) => parseTimestamp(m.timestamp)).filter((t) => t > 0);
    const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    const projectPath = decodeProjectPath(encodedProjectPath);

    return {
      id: sessionId,
      projectPath,
      projectName: extractProjectName(projectPath),
      encodedPath: encodedProjectPath,
      messages,
      firstMessage: firstMessageText.slice(0, 500),
      lastActivity,
      messageCount: messages.length,
    };
  } catch {
    return null;
  }
}
