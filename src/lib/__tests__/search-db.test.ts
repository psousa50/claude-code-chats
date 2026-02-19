import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync } from "fs";
import path from "path";
import os from "os";
import { createSearchDb, type SearchDbInstance } from "../search-db";
import {
  makeUserMessage,
  makeAssistantMessage,
  makeSystemMessage,
  makeMessageWithUsage,
  toJsonl,
  resetUuidCounter,
} from "./helpers";

const trivialDecode = (encoded: string) => "/" + encoded.replace(/-/g, "/");

let tmpDir: string;
let projectsDir: string;
let searchDb: SearchDbInstance;

beforeEach(() => {
  resetUuidCounter();
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "search-db-test-"));
  projectsDir = path.join(tmpDir, "projects");
  mkdirSync(projectsDir, { recursive: true });

  searchDb = createSearchDb({
    dbPath: ":memory:",
    projectsDir,
    decodeProjectPath: trivialDecode,
  });
});

afterEach(() => {
  searchDb.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeSession(encodedProject: string, sessionId: string, content: string): string {
  const dir = path.join(projectsDir, encodedProject);
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${sessionId}.jsonl`);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("migrations", () => {
  it("creates schema on fresh database", () => {
    const stats = searchDb.getIndexStats();
    expect(stats).toEqual({ fileCount: 0, messageCount: 0 });
  });

  it("initialises idempotently", () => {
    const db2 = createSearchDb({
      dbPath: ":memory:",
      projectsDir,
      decodeProjectPath: trivialDecode,
    });
    expect(db2.getIndexStats()).toEqual({ fileCount: 0, messageCount: 0 });
    db2.close();
  });
});

describe("syncIndex", () => {
  it("returns zeroes for empty projects dir", () => {
    expect(searchDb.syncIndex()).toEqual({ added: 0, updated: 0, removed: 0 });
  });

  it("indexes a session file", () => {
    writeSession("my-project", "sess1", toJsonl([
      makeUserMessage("hello world"),
      makeAssistantMessage("hi there"),
    ]));

    const result = searchDb.syncIndex();
    expect(result).toEqual({ added: 1, updated: 0, removed: 0 });
    expect(searchDb.getIndexStats()).toEqual({ fileCount: 1, messageCount: 2 });
  });

  it("returns zeroes on second sync with no changes", () => {
    writeSession("my-project", "sess1", toJsonl([makeUserMessage("hello")]));
    searchDb.syncIndex();

    expect(searchDb.syncIndex()).toEqual({ added: 0, updated: 0, removed: 0 });
  });

  it("detects updated files by mtime", () => {
    const filePath = writeSession("my-project", "sess1", toJsonl([makeUserMessage("hello")]));
    searchDb.syncIndex();

    const future = new Date(Date.now() + 5000);
    writeFileSync(filePath, toJsonl([makeUserMessage("hello"), makeAssistantMessage("world")]));
    utimesSync(filePath, future, future);

    const result = searchDb.syncIndex();
    expect(result).toEqual({ added: 0, updated: 1, removed: 0 });
    expect(searchDb.getIndexStats().messageCount).toBe(2);
  });

  it("detects removed files", () => {
    const filePath = writeSession("my-project", "sess1", toJsonl([makeUserMessage("hello")]));
    searchDb.syncIndex();

    rmSync(filePath);

    const result = searchDb.syncIndex();
    expect(result).toEqual({ added: 0, updated: 0, removed: 1 });
    expect(searchDb.getIndexStats()).toEqual({ fileCount: 0, messageCount: 0 });
  });

  it("ignores agent- prefixed files", () => {
    const dir = path.join(projectsDir, "my-project");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "agent-task.jsonl"), toJsonl([makeUserMessage("agent msg")]));

    expect(searchDb.syncIndex()).toEqual({ added: 0, updated: 0, removed: 0 });
  });

  it("ignores non-jsonl files", () => {
    const dir = path.join(projectsDir, "my-project");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "notes.txt"), "some notes");

    expect(searchDb.syncIndex()).toEqual({ added: 0, updated: 0, removed: 0 });
  });

  it("does not index system messages", () => {
    writeSession("my-project", "sess1", toJsonl([
      makeSystemMessage("system init"),
      makeUserMessage("real question"),
    ]));

    searchDb.syncIndex();
    expect(searchDb.getIndexStats().messageCount).toBe(1);
  });
});

describe("search", () => {
  beforeEach(() => {
    writeSession("my-project", "sess1", toJsonl([
      makeUserMessage("fix the authentication bug"),
      makeAssistantMessage("I'll check the auth module for issues"),
    ]));
    writeSession("other-project", "sess2", toJsonl([
      makeUserMessage("add dark mode to the UI"),
    ]));
    searchDb.syncIndex();
  });

  it("returns empty array for empty query", () => {
    expect(searchDb.search("")).toEqual([]);
  });

  it("returns empty array for whitespace query", () => {
    expect(searchDb.search("   ")).toEqual([]);
  });

  it("finds matching content", () => {
    const results = searchDb.search("authentication");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].sessionId).toBe("sess1");
  });

  it("returns results with correct shape", () => {
    const results = searchDb.search("authentication");
    const result = results[0];
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("sessionId");
    expect(result).toHaveProperty("projectPath");
    expect(result).toHaveProperty("projectName");
    expect(result).toHaveProperty("messageUuid");
    expect(result).toHaveProperty("userType");
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("snippet");
    expect(result).toHaveProperty("rank");
  });

  it("includes mark tags in snippet", () => {
    const results = searchDb.search("authentication");
    expect(results[0].snippet).toContain("<mark>");
    expect(results[0].snippet).toContain("</mark>");
  });

  it("filters by project path", () => {
    const results = searchDb.search("dark mode", 50, "other-project");
    expect(results.length).toBe(1);
    expect(results[0].projectPath).toBe("other-project");
  });

  it("returns no results for unmatched project filter", () => {
    const results = searchDb.search("authentication", 50, "other-project");
    expect(results).toEqual([]);
  });

  it("respects limit parameter", () => {
    const results = searchDb.search("the", 1);
    expect(results.length).toBe(1);
  });

  it("returns empty array for no matches", () => {
    expect(searchDb.search("xyznonexistent")).toEqual([]);
  });

  it("derives projectName from decoded path", () => {
    const results = searchDb.search("authentication");
    expect(results[0].projectName).toBe("project");
  });
});

describe("getIndexStats", () => {
  it("returns zeroes for empty database", () => {
    expect(searchDb.getIndexStats()).toEqual({ fileCount: 0, messageCount: 0 });
  });

  it("returns correct counts after sync", () => {
    writeSession("proj", "s1", toJsonl([
      makeUserMessage("msg1"),
      makeAssistantMessage("msg2"),
    ]));
    writeSession("proj", "s2", toJsonl([
      makeUserMessage("msg3"),
    ]));
    searchDb.syncIndex();

    expect(searchDb.getIndexStats()).toEqual({ fileCount: 2, messageCount: 3 });
  });
});

describe("getSummary / saveSummary", () => {
  it("returns null for nonexistent summary", () => {
    expect(searchDb.getSummary("session", "s1", "proj")).toBeNull();
  });

  it("round-trips a saved summary", () => {
    const saved = searchDb.saveSummary({
      type: "session",
      targetId: "s1",
      projectPath: "proj",
      content: "Fixed a login bug",
      createdAt: 1700000000000,
      messageCount: 5,
    });

    expect(saved.id).toBe("session-proj-s1");

    const retrieved = searchDb.getSummary("session", "s1", "proj");
    expect(retrieved).toEqual(saved);
  });

  it("upserts on duplicate key", () => {
    searchDb.saveSummary({
      type: "session",
      targetId: "s1",
      projectPath: "proj",
      content: "First version",
      createdAt: 1700000000000,
      messageCount: 3,
    });

    searchDb.saveSummary({
      type: "session",
      targetId: "s1",
      projectPath: "proj",
      content: "Updated version",
      createdAt: 1700000001000,
      messageCount: 5,
    });

    const retrieved = searchDb.getSummary("session", "s1", "proj");
    expect(retrieved!.content).toBe("Updated version");
    expect(retrieved!.messageCount).toBe(5);
  });
});

describe("getSessionSummaries", () => {
  it("returns empty array for unknown project", () => {
    expect(searchDb.getSessionSummaries("unknown")).toEqual([]);
  });

  it("returns all session summaries for a project", () => {
    searchDb.saveSummary({
      type: "session",
      targetId: "s1",
      projectPath: "proj",
      content: "Summary 1",
      createdAt: 1700000000000,
      messageCount: 3,
    });
    searchDb.saveSummary({
      type: "session",
      targetId: "s2",
      projectPath: "proj",
      content: "Summary 2",
      createdAt: 1700000001000,
      messageCount: 5,
    });
    searchDb.saveSummary({
      type: "project",
      targetId: "proj",
      projectPath: "proj",
      content: "Project summary",
      createdAt: 1700000002000,
      messageCount: 10,
    });

    const results = searchDb.getSessionSummaries("proj");
    expect(results.length).toBe(2);
    expect(results.every((r) => r.type === "session")).toBe(true);
  });
});

describe("getSessionSummariesFromDb", () => {
  it("returns sessions ordered by mtime descending", () => {
    writeSession("proj", "s1", toJsonl([makeUserMessage("first")]));
    writeSession("proj", "s2", toJsonl([makeUserMessage("second")]));
    searchDb.syncIndex();

    const results = searchDb.getSessionSummariesFromDb("proj");
    expect(results.length).toBe(2);
    expect(results[0].lastActivity).toBeGreaterThanOrEqual(results[1].lastActivity);
  });

  it("filters out sessions with zero visible messages", () => {
    writeSession("proj", "s1", toJsonl([makeSystemMessage("only system")]));
    writeSession("proj", "s2", toJsonl([makeUserMessage("visible")]));
    searchDb.syncIndex();

    const results = searchDb.getSessionSummariesFromDb("proj");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("s2");
  });
});

describe("getProjectStats", () => {
  it("returns stats grouped by project", () => {
    writeSession("proj-a", "s1", toJsonl([
      makeUserMessage("msg1"),
      makeAssistantMessage("msg2"),
    ]));
    writeSession("proj-b", "s1", toJsonl([
      makeUserMessage("msg3"),
    ]));
    searchDb.syncIndex();

    const stats = searchDb.getProjectStats();
    expect(stats.get("proj-a")).toEqual({ sessionCount: 1, totalMessages: 2 });
    expect(stats.get("proj-b")).toEqual({ sessionCount: 1, totalMessages: 1 });
  });

  it("auto-syncs when database is empty", () => {
    writeSession("proj", "s1", toJsonl([makeUserMessage("auto sync")]));

    const stats = searchDb.getProjectStats();
    expect(stats.get("proj")?.totalMessages).toBe(1);
  });
});

describe("renameProjectInIndex", () => {
  it("updates all tables with new project path", () => {
    writeSession("old-project", "s1", toJsonl([makeUserMessage("hello")]));
    searchDb.syncIndex();

    searchDb.saveSummary({
      type: "session",
      targetId: "s1",
      projectPath: "old-project",
      content: "A summary",
      createdAt: 1700000000000,
      messageCount: 1,
    });

    searchDb.renameProjectInIndex("old-project", "new-project");

    const stats = searchDb.getProjectStats();
    expect(stats.has("old-project")).toBe(false);
    expect(stats.get("new-project")).toEqual({ sessionCount: 1, totalMessages: 1 });

    const results = searchDb.search("hello");
    expect(results[0].projectPath).toBe("new-project");

    const summary = searchDb.getSummary("session", "s1", "new-project");
    expect(summary).not.toBeNull();
    expect(summary!.id).toContain("new-project");

    expect(searchDb.getSummary("session", "s1", "old-project")).toBeNull();
  });
});
