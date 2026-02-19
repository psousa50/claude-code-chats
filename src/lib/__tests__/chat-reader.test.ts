import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'
import { createChatReader, type ChatReaderInstance } from '../chat-reader'
import {
  makeUserMessage,
  makeAssistantMessage,
  makeSystemMessage,
  makeMessageWithUsage,
  toJsonl,
  writeTempProject,
  resetUuidCounter,
} from './helpers'

const simpleDecode = (encoded: string) => '/' + encoded.replace(/-/g, '/')
const emptyStats = () => new Map<string, { sessionCount: number; totalMessages: number }>()
const noDbSessions = () =>
  [] as { id: string; firstMessage: string; messageCount: number; lastActivity: number }[]

let tmpDir: string
let projectsDir: string
let reader: ChatReaderInstance

beforeEach(() => {
  resetUuidCounter()
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'chat-reader-test-'))
  projectsDir = path.join(tmpDir, 'projects')
  mkdirSync(projectsDir, { recursive: true })

  reader = createChatReader({
    projectsDir,
    decodeProjectPath: simpleDecode,
    getProjectStats: emptyStats,
    getSessionSummariesFromDb: noDbSessions,
  })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('getAllProjects', () => {
  it('returns empty array for empty projects dir', () => {
    expect(reader.getAllProjects()).toEqual([])
  })

  it('returns project with sessions', () => {
    writeTempProject(projectsDir, 'my-project', {
      sess1: toJsonl([
        makeUserMessage('hello', { timestamp: '2026-01-15T10:00:00Z' }),
        makeAssistantMessage('hi', { timestamp: '2026-01-15T10:01:00Z' }),
      ]),
    })

    const projects = reader.getAllProjects()
    expect(projects.length).toBe(1)
    expect(projects[0].name).toBe('project')
    expect(projects[0].encodedPath).toBe('my-project')
    expect(projects[0].sessions.length).toBe(1)
    expect(projects[0].totalMessages).toBe(2)
  })

  it('filters out projects with no jsonl files', () => {
    mkdirSync(path.join(projectsDir, 'empty-project'), { recursive: true })
    expect(reader.getAllProjects()).toEqual([])
  })

  it('filters out projects with only empty jsonl files', () => {
    writeTempProject(projectsDir, 'empty-sessions', { sess1: '' })
    expect(reader.getAllProjects()).toEqual([])
  })

  it('ignores agent- prefixed files', () => {
    const dir = path.join(projectsDir, 'my-project')
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'agent-task.jsonl'), toJsonl([makeUserMessage('agent msg')]))
    expect(reader.getAllProjects()).toEqual([])
  })

  it('sorts projects by lastActivity descending', () => {
    writeTempProject(projectsDir, 'old-project', {
      s1: toJsonl([makeUserMessage('old', { timestamp: 1000000000000 })]),
    })
    writeTempProject(projectsDir, 'new-project', {
      s1: toJsonl([makeUserMessage('new', { timestamp: 2000000000000 })]),
    })

    const projects = reader.getAllProjects()
    expect(projects[0].encodedPath).toBe('new-project')
    expect(projects[1].encodedPath).toBe('old-project')
  })
})

describe('getProjectByPath', () => {
  it('returns project for valid encoded path', () => {
    writeTempProject(projectsDir, 'my-project', {
      sess1: toJsonl([makeUserMessage('hello')]),
    })

    const project = reader.getProjectByPath('my-project')
    expect(project).not.toBeNull()
    expect(project!.encodedPath).toBe('my-project')
    expect(project!.sessions.length).toBe(1)
  })

  it('returns null for nonexistent path', () => {
    expect(reader.getProjectByPath('does-not-exist')).toBeNull()
  })

  it('returns null for project with no sessions', () => {
    writeTempProject(projectsDir, 'empty', { s1: '' })
    expect(reader.getProjectByPath('empty')).toBeNull()
  })
})

describe('getProjectsSummary', () => {
  it('returns summaries for projects whose decoded paths exist', () => {
    const decodedPath = path.join(tmpDir, 'real-project')
    mkdirSync(decodedPath, { recursive: true })

    const encodedPath = decodedPath.replace(/\//g, '-')

    const localReader = createChatReader({
      projectsDir,
      decodeProjectPath: () => decodedPath,
      getProjectStats: emptyStats,
      getSessionSummariesFromDb: noDbSessions,
    })

    writeTempProject(projectsDir, encodedPath, {
      s1: toJsonl([makeUserMessage('hello')]),
    })

    const summaries = localReader.getProjectsSummary()
    expect(summaries.length).toBe(1)
    expect(summaries[0].sessionCount).toBe(1)
  })

  it('detects hasMemory when MEMORY.md exists', () => {
    const decodedPath = path.join(tmpDir, 'mem-project')
    mkdirSync(decodedPath, { recursive: true })

    const encodedPath = 'mem-project'

    const localReader = createChatReader({
      projectsDir,
      decodeProjectPath: () => decodedPath,
      getProjectStats: emptyStats,
      getSessionSummariesFromDb: noDbSessions,
    })

    const projDir = path.join(projectsDir, encodedPath)
    writeTempProject(projectsDir, encodedPath, {
      s1: toJsonl([makeUserMessage('hello')]),
    })
    mkdirSync(path.join(projDir, 'memory'), { recursive: true })
    writeFileSync(path.join(projDir, 'memory', 'MEMORY.md'), 'some memory')

    const summaries = localReader.getProjectsSummary()
    expect(summaries[0].hasMemory).toBe(true)
  })

  it('uses injected getProjectStats for counts', () => {
    const decodedPath = path.join(tmpDir, 'stats-project')
    mkdirSync(decodedPath, { recursive: true })

    const encodedPath = 'stats-project'

    const localReader = createChatReader({
      projectsDir,
      decodeProjectPath: () => decodedPath,
      getProjectStats: () => new Map([[encodedPath, { sessionCount: 5, totalMessages: 100 }]]),
      getSessionSummariesFromDb: noDbSessions,
    })

    writeTempProject(projectsDir, encodedPath, {
      s1: toJsonl([makeUserMessage('hello')]),
    })

    const summaries = localReader.getProjectsSummary()
    expect(summaries[0].sessionCount).toBe(5)
    expect(summaries[0].totalMessages).toBe(100)
  })

  it('falls back to file count when stats are empty', () => {
    const decodedPath = path.join(tmpDir, 'fallback-project')
    mkdirSync(decodedPath, { recursive: true })

    const localReader = createChatReader({
      projectsDir,
      decodeProjectPath: () => decodedPath,
      getProjectStats: emptyStats,
      getSessionSummariesFromDb: noDbSessions,
    })

    writeTempProject(projectsDir, 'fallback-project', {
      s1: toJsonl([makeUserMessage('a')]),
      s2: toJsonl([makeUserMessage('b')]),
    })

    const summaries = localReader.getProjectsSummary()
    expect(summaries[0].sessionCount).toBe(2)
    expect(summaries[0].totalMessages).toBe(0)
  })
})

describe('getSessionsSummary', () => {
  it('uses DB data when available', () => {
    const localReader = createChatReader({
      projectsDir,
      decodeProjectPath: simpleDecode,
      getProjectStats: emptyStats,
      getSessionSummariesFromDb: () => [
        { id: 's1', firstMessage: 'from db', messageCount: 10, lastActivity: 1700000000000 },
      ],
    })

    writeTempProject(projectsDir, 'proj', {
      s1: toJsonl([makeUserMessage('from file')]),
    })

    const summaries = localReader.getSessionsSummary('proj')
    expect(summaries.length).toBe(1)
    expect(summaries[0].firstMessage).toBe('from db')
    expect(summaries[0].encodedPath).toBe('proj')
  })

  it('falls back to filesystem when DB returns empty', () => {
    writeTempProject(projectsDir, 'proj', {
      s1: toJsonl([makeUserMessage('from filesystem'), makeAssistantMessage('reply')]),
    })

    const summaries = reader.getSessionsSummary('proj')
    expect(summaries.length).toBe(1)
    expect(summaries[0].firstMessage).toBe('from filesystem')
    expect(summaries[0].messageCount).toBe(2)
  })

  it('filters out sessions with no user messages', () => {
    writeTempProject(projectsDir, 'proj', {
      s1: toJsonl([makeAssistantMessage('only assistant')]),
    })

    const summaries = reader.getSessionsSummary('proj')
    expect(summaries).toEqual([])
  })

  it('returns empty for nonexistent project', () => {
    expect(reader.getSessionsSummary('nope')).toEqual([])
  })

  it('sorts by lastActivity descending', () => {
    writeTempProject(projectsDir, 'proj', {
      old: toJsonl([makeUserMessage('old', { timestamp: 1000000000000 })]),
      new: toJsonl([makeUserMessage('new', { timestamp: 2000000000000 })]),
    })

    const summaries = reader.getSessionsSummary('proj')
    expect(summaries.length).toBe(2)
  })
})

describe('getSessionById', () => {
  it('returns session for valid id', () => {
    writeTempProject(projectsDir, 'proj', {
      sess1: toJsonl([
        makeUserMessage('fix the bug', { timestamp: '2026-01-15T10:00:00Z' }),
        makeAssistantMessage('on it', { timestamp: '2026-01-15T10:01:00Z' }),
      ]),
    })

    const session = reader.getSessionById('proj', 'sess1')
    expect(session).not.toBeNull()
    expect(session!.id).toBe('sess1')
    expect(session!.firstMessage).toBe('fix the bug')
    expect(session!.messageCount).toBe(2)
    expect(session!.messages.length).toBe(2)
  })

  it('returns null for nonexistent session', () => {
    writeTempProject(projectsDir, 'proj', { s1: toJsonl([makeUserMessage('a')]) })
    expect(reader.getSessionById('proj', 'nope')).toBeNull()
  })

  it('returns null for empty session file', () => {
    writeTempProject(projectsDir, 'proj', { empty: '' })
    expect(reader.getSessionById('proj', 'empty')).toBeNull()
  })

  it('includes tokenUsage when messages have usage data', () => {
    writeTempProject(projectsDir, 'proj', {
      s1: toJsonl([
        makeUserMessage('q'),
        makeMessageWithUsage('answer', { input: 100, output: 50, cacheCreation: 10, cacheRead: 5 }),
      ]),
    })

    const session = reader.getSessionById('proj', 's1')
    expect(session!.tokenUsage).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 5,
    })
  })

  it('omits tokenUsage when no messages have usage', () => {
    writeTempProject(projectsDir, 'proj', {
      s1: toJsonl([makeUserMessage('no usage'), makeAssistantMessage('nope')]),
    })

    const session = reader.getSessionById('proj', 's1')
    expect(session!.tokenUsage).toBeUndefined()
  })

  it('excludes system messages from messageCount', () => {
    writeTempProject(projectsDir, 'proj', {
      s1: toJsonl([
        makeSystemMessage('init'),
        makeUserMessage('real question'),
        makeAssistantMessage('real answer'),
      ]),
    })

    const session = reader.getSessionById('proj', 's1')
    expect(session!.messageCount).toBe(2)
    expect(session!.messages.length).toBe(3)
  })

  it('truncates firstMessage to 500 chars', () => {
    const longText = 'a'.repeat(1000)
    writeTempProject(projectsDir, 'proj', {
      s1: toJsonl([makeUserMessage(longText)]),
    })

    const session = reader.getSessionById('proj', 's1')
    expect(session!.firstMessage.length).toBe(500)
  })

  it("uses 'No messages' when only system messages exist", () => {
    writeTempProject(projectsDir, 'proj', {
      s1: toJsonl([makeSystemMessage('only system'), makeAssistantMessage('response')]),
    })

    const session = reader.getSessionById('proj', 's1')
    expect(session!.firstMessage).toBe('No messages')
  })
})
