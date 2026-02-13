import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ChatMessage, ChatSession, Project, ProjectSummary, SessionSummary, TokenUsage } from "./types";
import { isSystemMessage as isSystemMsg, hasNoVisibleContent } from "./message-utils";

const CLAUDE_DIR = path.join(process.env.HOME || "", ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

function tryRecursiveDecode(parts: string[]): string | null {
  function tryDecode(index: number, currentPath: string): string | null {
    if (index >= parts.length) {
      return fs.existsSync(currentPath) ? currentPath : null;
    }

    for (let end = parts.length; end > index; end--) {
      const segment = parts.slice(index, end).join("-");
      const tryPath = currentPath + "/" + segment;

      if (fs.existsSync(tryPath)) {
        const result = tryDecode(end, tryPath);
        if (result) return result;
      }
    }

    return null;
  }

  return tryDecode(0, "");
}

function tryGlobDecode(parts: string[]): string | null {
  let knownPrefix = "";
  let startIndex = 0;

  for (let i = 0; i < parts.length; i++) {
    const testPath = knownPrefix + "/" + parts[i];
    if (fs.existsSync(testPath)) {
      knownPrefix = testPath;
      startIndex = i + 1;
    } else {
      break;
    }
  }

  if (startIndex >= parts.length) {
    return knownPrefix;
  }

  const remainingParts = parts.slice(startIndex);
  const globPattern = knownPrefix + "/*" + remainingParts.join("*") + "*";

  try {
    const result = execSync(`ls -d ${globPattern} 2>/dev/null`, { encoding: "utf-8" }).trim();
    const matches = result.split("\n").filter(Boolean);

    if (matches.length === 1) {
      return matches[0];
    }
  } catch {
    // No matches or error
  }

  return null;
}

const decodedPathCache = new Map<string, string>();

export function decodeProjectPath(encodedPath: string): string {
  const cached = decodedPathCache.get(encodedPath);
  if (cached !== undefined) return cached;

  const simpleDecode = encodedPath.replace(/-/g, "/");

  if (fs.existsSync(simpleDecode)) {
    decodedPathCache.set(encodedPath, simpleDecode);
    return simpleDecode;
  }

  const parts = encodedPath.split("-").filter(Boolean);

  const recursiveResult = tryRecursiveDecode(parts);
  if (recursiveResult && fs.existsSync(recursiveResult)) {
    decodedPathCache.set(encodedPath, recursiveResult);
    return recursiveResult;
  }

  const globResult = tryGlobDecode(parts);
  if (globResult) {
    decodedPathCache.set(encodedPath, globResult);
    return globResult;
  }

  decodedPathCache.set(encodedPath, simpleDecode);
  return simpleDecode;
}

export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, "-");
}

const TEMP_PREFIXES = ["/tmp", "/var/folders", "/private/tmp", "/private/var/folders"];

function isTempPath(projectPath: string): boolean {
  return TEMP_PREFIXES.some((prefix) => projectPath.startsWith(prefix));
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

function computeSessionTokens(messages: ChatMessage[]): TokenUsage | undefined {
  let input = 0, output = 0, cacheCreation = 0, cacheRead = 0;
  let found = false;

  for (const msg of messages) {
    const usage = msg.message.usage;
    if (!usage) continue;
    found = true;
    input += usage.input_tokens || 0;
    output += usage.output_tokens || 0;
    cacheCreation += usage.cache_creation_input_tokens || 0;
    cacheRead += usage.cache_read_input_tokens || 0;
  }

  if (!found) return undefined;

  return {
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: cacheCreation,
    cache_read_input_tokens: cacheRead,
  };
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
        const visibleCount = messages.filter((m) => !isSystemMsg(m) && !hasNoVisibleContent(m)).length;
        const tokenUsage = computeSessionTokens(messages);

        return {
          id: sessionId,
          projectPath,
          projectName: extractProjectName(projectPath),
          encodedPath,
          messages,
          firstMessage: firstMessageText.slice(0, 500),
          lastActivity,
          messageCount: visibleCount,
          ...(tokenUsage && { tokenUsage }),
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

        const projectPath = decodeProjectPath(dir);

        if (!fs.existsSync(projectPath) || isTempPath(projectPath)) {
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

          totalMessages += countVisibleMessages(filePath);
          const mtime = fileStat.mtime.getTime();
          if (mtime > lastActivity) {
            lastActivity = mtime;
          }
        }

        if (totalMessages === 0) {
          return null;
        }

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

function countVisibleMessages(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    let count = 0;
    let start = 0;

    while (start < content.length) {
      const end = content.indexOf("\n", start);
      const line = end === -1 ? content.slice(start) : content.slice(start, end);
      start = end === -1 ? content.length : end + 1;

      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line) as ChatMessage;
        if ((msg.type === "user" || msg.type === "assistant") && !isSystemMsg(msg) && !hasNoVisibleContent(msg)) {
          count++;
        }
      } catch {
        continue;
      }
    }

    return count;
  } catch {
    return 0;
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
        const visibleCount = countVisibleMessages(filePath);

        return {
          id: sessionId,
          encodedPath,
          firstMessage: firstMessageText.slice(0, 500),
          messageCount: visibleCount,
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
    const visibleCount = messages.filter((m) => !isSystemMsg(m) && !hasNoVisibleContent(m)).length;
    const tokenUsage = computeSessionTokens(messages);

    return {
      id: sessionId,
      projectPath,
      projectName: extractProjectName(projectPath),
      encodedPath: encodedProjectPath,
      messages,
      firstMessage: firstMessageText.slice(0, 500),
      lastActivity,
      messageCount: visibleCount,
      ...(tokenUsage && { tokenUsage }),
    };
  } catch {
    return null;
  }
}
