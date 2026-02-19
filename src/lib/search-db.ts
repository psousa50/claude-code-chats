import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { AISummary, ChatMessage } from "./types";
import { decodeProjectPath as defaultDecodeProjectPath } from "./chat-reader";

const CLAUDE_DIR = path.join(process.env.HOME || "", ".claude");
const DEFAULT_PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const DEFAULT_DB_PATH = path.join(CLAUDE_DIR, "chat-search.db");

const migrations: ((db: Database.Database) => void)[] = [
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS indexed_files (
        path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        project_path TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content,
        session_id,
        project_path,
        message_uuid,
        user_type,
        timestamp
      );

      CREATE TABLE IF NOT EXISTS summaries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        message_count INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_summaries_lookup
        ON summaries(type, target_id, project_path);
    `);
  },
  (db) => {
    db.exec("ALTER TABLE indexed_files ADD COLUMN visible_message_count INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE indexed_files ADD COLUMN first_message TEXT NOT NULL DEFAULT ''");
    db.exec("DELETE FROM indexed_files");
    db.exec("DELETE FROM messages_fts");
  },
];

function runMigrations(database: Database.Database): void {
  const currentVersion = (database.pragma("user_version", { simple: true }) as number) ?? 0;

  for (let i = currentVersion; i < migrations.length; i++) {
    database.transaction(() => {
      migrations[i](database);
      database.pragma(`user_version = ${i + 1}`);
    })();
  }
}

function initDatabase(database: Database.Database): void {
  runMigrations(database);
}

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

interface FileInfo {
  path: string;
  mtime: number;
  sessionId: string;
  projectPath: string;
  encodedPath: string;
}

export interface SearchResult {
  content: string;
  sessionId: string;
  projectPath: string;
  projectName: string;
  messageUuid: string;
  userType: string;
  timestamp: number;
  snippet: string;
  rank: number;
}

export interface SearchDbDeps {
  dbPath?: string;
  projectsDir?: string;
  decodeProjectPath?: (encoded: string) => string;
}

export type SearchDbInstance = ReturnType<typeof createSearchDb>;

export function createSearchDb(deps?: SearchDbDeps) {
  const projectsDir = deps?.projectsDir ?? DEFAULT_PROJECTS_DIR;
  const decode = deps?.decodeProjectPath ?? defaultDecodeProjectPath;
  const db = new Database(deps?.dbPath ?? DEFAULT_DB_PATH);
  initDatabase(db);

  function getAllJsonlFiles(): FileInfo[] {
    const files: FileInfo[] = [];

    if (!fs.existsSync(projectsDir)) {
      return files;
    }

    const projectDirs = fs.readdirSync(projectsDir);

    for (const dir of projectDirs) {
      const projectDirPath = path.join(projectsDir, dir);
      const stat = fs.statSync(projectDirPath);

      if (!stat.isDirectory()) continue;

      const sessionFiles = fs.readdirSync(projectDirPath);
      for (const file of sessionFiles) {
        if (!file.endsWith(".jsonl") || file.startsWith("agent-")) continue;

        const filePath = path.join(projectDirPath, file);
        const fileStat = fs.statSync(filePath);

        files.push({
          path: filePath,
          mtime: fileStat.mtime.getTime(),
          sessionId: file.replace(".jsonl", ""),
          projectPath: decode(dir),
          encodedPath: dir,
        });
      }
    }

    return files;
  }

  function indexFile(fileInfo: FileInfo): void {
    const messages = parseJsonlFile(fileInfo.path);

    const insertMessage = db.prepare(`
      INSERT INTO messages_fts (content, session_id, project_path, message_uuid, user_type, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let visibleCount = 0;
    let firstMessage = "";
    for (const message of messages) {
      if (isSystemMessage(message)) continue;

      const content = extractTextFromContent(message.message.content);
      if (!content.trim()) continue;

      visibleCount++;
      if (!firstMessage && message.type === "user") {
        firstMessage = content.slice(0, 500);
      }
      insertMessage.run(
        content,
        fileInfo.sessionId,
        fileInfo.encodedPath,
        message.uuid,
        message.type,
        parseTimestamp(message.timestamp).toString()
      );
    }

    const upsertFile = db.prepare(`
      INSERT OR REPLACE INTO indexed_files (path, mtime, session_id, project_path, visible_message_count, first_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    upsertFile.run(fileInfo.path, fileInfo.mtime, fileInfo.sessionId, fileInfo.encodedPath, visibleCount, firstMessage);
  }

  function removeFileFromIndex(filePath: string): void {
    const fileRecord = db
      .prepare("SELECT session_id, project_path FROM indexed_files WHERE path = ?")
      .get(filePath) as { session_id: string; project_path: string } | undefined;

    if (fileRecord) {
      db
        .prepare("DELETE FROM messages_fts WHERE session_id = ? AND project_path = ?")
        .run(fileRecord.session_id, fileRecord.project_path);

      db.prepare("DELETE FROM indexed_files WHERE path = ?").run(filePath);
    }
  }

  function syncIndex(): { added: number; updated: number; removed: number } {
    const currentFiles = getAllJsonlFiles();
    const currentFilePaths = new Set(currentFiles.map((f) => f.path));

    const indexedFiles = db.prepare("SELECT path, mtime FROM indexed_files").all() as {
      path: string;
      mtime: number;
    }[];
    const indexedFileMap = new Map(indexedFiles.map((f) => [f.path, f.mtime]));

    let added = 0;
    let updated = 0;
    let removed = 0;

    const transaction = db.transaction(() => {
      for (const fileInfo of currentFiles) {
        const indexedMtime = indexedFileMap.get(fileInfo.path);

        if (indexedMtime === undefined) {
          indexFile(fileInfo);
          added++;
        } else if (indexedMtime < fileInfo.mtime) {
          removeFileFromIndex(fileInfo.path);
          indexFile(fileInfo);
          updated++;
        }
      }

      for (const [filePath] of indexedFileMap) {
        if (!currentFilePaths.has(filePath)) {
          removeFileFromIndex(filePath);
          removed++;
        }
      }
    });

    transaction();

    return { added, updated, removed };
  }

  function search(query: string, limit: number = 50, projectPath?: string): SearchResult[] {
    if (!query.trim()) {
      return [];
    }

    const searchQuery = query
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"*`)
      .join(" ");

    const sqlQuery = projectPath
      ? `
        SELECT
          content,
          session_id,
          project_path,
          message_uuid,
          user_type,
          timestamp,
          snippet(messages_fts, 0, '<mark>', '</mark>', '...', 64) as snippet,
          rank
        FROM messages_fts
        WHERE messages_fts MATCH ? AND project_path = ?
        ORDER BY rank
        LIMIT ?
      `
      : `
        SELECT
          content,
          session_id,
          project_path,
          message_uuid,
          user_type,
          timestamp,
          snippet(messages_fts, 0, '<mark>', '</mark>', '...', 64) as snippet,
          rank
        FROM messages_fts
        WHERE messages_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;

    const params = projectPath ? [searchQuery, projectPath, limit] : [searchQuery, limit];

    const results = db.prepare(sqlQuery).all(...params) as {
      content: string;
      session_id: string;
      project_path: string;
      message_uuid: string;
      user_type: string;
      timestamp: string;
      snippet: string;
      rank: number;
    }[];

    return results.map((row) => {
      const decodedPath = decode(row.project_path);
      const pathParts = decodedPath.split("/").filter(Boolean);
      const projectName = pathParts[pathParts.length - 1] || decodedPath;

      return {
        content: row.content,
        sessionId: row.session_id,
        projectPath: row.project_path,
        projectName,
        messageUuid: row.message_uuid,
        userType: row.user_type,
        timestamp: parseInt(row.timestamp, 10) || 0,
        snippet: row.snippet,
        rank: row.rank,
      };
    });
  }

  function getIndexStats(): { fileCount: number; messageCount: number } {
    const fileCount = (
      db.prepare("SELECT COUNT(*) as count FROM indexed_files").get() as { count: number }
    ).count;

    const messageCount = (
      db.prepare("SELECT COUNT(*) as count FROM messages_fts").get() as { count: number }
    ).count;

    return { fileCount, messageCount };
  }

  function getSummary(
    type: "session" | "project",
    targetId: string,
    projectPath: string
  ): AISummary | null {
    const row = db
      .prepare(
        "SELECT id, type, target_id, project_path, content, created_at, message_count FROM summaries WHERE type = ? AND target_id = ? AND project_path = ?"
      )
      .get(type, targetId, projectPath) as
      | {
          id: string;
          type: string;
          target_id: string;
          project_path: string;
          content: string;
          created_at: number;
          message_count: number;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      type: row.type as "session" | "project",
      targetId: row.target_id,
      projectPath: row.project_path,
      content: row.content,
      createdAt: row.created_at,
      messageCount: row.message_count,
    };
  }

  function saveSummary(summary: Omit<AISummary, "id">): AISummary {
    const id = `${summary.type}-${summary.projectPath}-${summary.targetId}`;

    db
      .prepare(
        `INSERT OR REPLACE INTO summaries (id, type, target_id, project_path, content, created_at, message_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        summary.type,
        summary.targetId,
        summary.projectPath,
        summary.content,
        summary.createdAt,
        summary.messageCount
      );

    return { ...summary, id };
  }

  function getSessionSummaries(projectPath: string): AISummary[] {
    const rows = db
      .prepare(
        "SELECT id, type, target_id, project_path, content, created_at, message_count FROM summaries WHERE type = 'session' AND project_path = ?"
      )
      .all(projectPath) as {
      id: string;
      type: string;
      target_id: string;
      project_path: string;
      content: string;
      created_at: number;
      message_count: number;
    }[];

    return rows.map((row) => ({
      id: row.id,
      type: row.type as "session" | "project",
      targetId: row.target_id,
      projectPath: row.project_path,
      content: row.content,
      createdAt: row.created_at,
      messageCount: row.message_count,
    }));
  }

  function getSessionSummariesFromDb(encodedPath: string): {
    id: string;
    firstMessage: string;
    messageCount: number;
    lastActivity: number;
  }[] {
    const rows = db.prepare(`
      SELECT session_id, first_message, visible_message_count, mtime
      FROM indexed_files
      WHERE project_path = ? AND visible_message_count > 0 AND first_message != ''
      ORDER BY mtime DESC
    `).all(encodedPath) as {
      session_id: string;
      first_message: string;
      visible_message_count: number;
      mtime: number;
    }[];

    return rows.map((row) => ({
      id: row.session_id,
      firstMessage: row.first_message,
      messageCount: row.visible_message_count,
      lastActivity: row.mtime,
    }));
  }

  function getProjectStats(): Map<string, { sessionCount: number; totalMessages: number }> {
    const fileCount = (
      db.prepare("SELECT COUNT(*) as count FROM indexed_files").get() as { count: number }
    ).count;

    if (fileCount === 0) {
      syncIndex();
    }

    const rows = db.prepare(`
      SELECT project_path, COUNT(*) as sessions, SUM(visible_message_count) as messages
      FROM indexed_files
      WHERE visible_message_count > 0
      GROUP BY project_path
    `).all() as { project_path: string; sessions: number; messages: number }[];

    const map = new Map<string, { sessionCount: number; totalMessages: number }>();
    for (const row of rows) {
      map.set(row.project_path, { sessionCount: row.sessions, totalMessages: row.messages });
    }
    return map;
  }

  function renameProjectInIndex(oldEncodedPath: string, newEncodedPath: string): void {
    const transaction = db.transaction(() => {
      db
        .prepare("UPDATE indexed_files SET project_path = ? WHERE project_path = ?")
        .run(newEncodedPath, oldEncodedPath);

      db
        .prepare("UPDATE messages_fts SET project_path = ? WHERE project_path = ?")
        .run(newEncodedPath, oldEncodedPath);

      db
        .prepare(
          "UPDATE summaries SET project_path = ?, id = REPLACE(id, ?, ?) WHERE project_path = ?"
        )
        .run(newEncodedPath, oldEncodedPath, newEncodedPath, oldEncodedPath);
    });

    transaction();
  }

  function close(): void {
    db.close();
  }

  return {
    syncIndex,
    search,
    getIndexStats,
    getSummary,
    saveSummary,
    getSessionSummaries,
    getSessionSummariesFromDb,
    getProjectStats,
    renameProjectInIndex,
    close,
  };
}

let defaultInstance: SearchDbInstance | null = null;

function getDefault(): SearchDbInstance {
  if (!defaultInstance) defaultInstance = createSearchDb();
  return defaultInstance;
}

export function syncIndex() { return getDefault().syncIndex(); }
export function search(query: string, limit?: number, projectPath?: string) { return getDefault().search(query, limit, projectPath); }
export function getIndexStats() { return getDefault().getIndexStats(); }
export function getSummary(type: "session" | "project", targetId: string, projectPath: string) { return getDefault().getSummary(type, targetId, projectPath); }
export function saveSummary(summary: Omit<AISummary, "id">) { return getDefault().saveSummary(summary); }
export function getSessionSummaries(projectPath: string) { return getDefault().getSessionSummaries(projectPath); }
export function getSessionSummariesFromDb(encodedPath: string) { return getDefault().getSessionSummariesFromDb(encodedPath); }
export function getProjectStats() { return getDefault().getProjectStats(); }
export function renameProjectInIndex(oldEncodedPath: string, newEncodedPath: string) { return getDefault().renameProjectInIndex(oldEncodedPath, newEncodedPath); }
