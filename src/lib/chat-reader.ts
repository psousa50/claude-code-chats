import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import {
  ChatMessage,
  ChatSession,
  Project,
  ProjectSummary,
  SessionSummary,
  SubagentSummary,
  TokenUsage,
} from './types'
import { isSystemMessage as isSystemMsg, hasNoVisibleContent } from './message-utils'
import {
  getProjectStats as defaultGetProjectStats,
  getSessionSummariesFromDb as defaultGetSessionSummariesFromDb,
} from './search-db'
import { DEFAULT_ARCHIVE_DIR } from './archive'

const CLAUDE_DIR = path.join(process.env.HOME || '', '.claude')
const DEFAULT_PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

function tryRecursiveDecode(parts: string[]): string | null {
  function tryDecode(index: number, currentPath: string): string | null {
    if (index >= parts.length) {
      return fs.existsSync(currentPath) ? currentPath : null
    }

    for (let end = parts.length; end > index; end--) {
      const segment = parts.slice(index, end).join('-')
      const tryPath = currentPath + '/' + segment

      if (fs.existsSync(tryPath)) {
        const result = tryDecode(end, tryPath)
        if (result) return result
      }
    }

    return null
  }

  return tryDecode(0, '')
}

function tryGlobDecode(parts: string[]): string | null {
  let knownPrefix = ''
  let startIndex = 0

  for (let i = 0; i < parts.length; i++) {
    const testPath = knownPrefix + '/' + parts[i]
    if (fs.existsSync(testPath)) {
      knownPrefix = testPath
      startIndex = i + 1
    } else {
      break
    }
  }

  if (startIndex >= parts.length) {
    return knownPrefix
  }

  const remainingParts = parts.slice(startIndex)
  const globPattern = knownPrefix + '/*' + remainingParts.join('*') + '*'

  try {
    const result = execSync(`ls -d ${globPattern} 2>/dev/null`, { encoding: 'utf-8' }).trim()
    const matches = result.split('\n').filter(Boolean)

    if (matches.length === 1) {
      return matches[0]
    }
  } catch {
    // No matches or error
  }

  return null
}

const decodedPathCache = new Map<string, string>()

export function decodeProjectPath(encodedPath: string): string {
  const cached = decodedPathCache.get(encodedPath)
  if (cached !== undefined) return cached

  const simpleDecode = encodedPath.replace(/-/g, '/')

  if (fs.existsSync(simpleDecode)) {
    decodedPathCache.set(encodedPath, simpleDecode)
    return simpleDecode
  }

  const parts = encodedPath.split('-').filter(Boolean)

  const recursiveResult = tryRecursiveDecode(parts)
  if (recursiveResult && fs.existsSync(recursiveResult)) {
    decodedPathCache.set(encodedPath, recursiveResult)
    return recursiveResult
  }

  const globResult = tryGlobDecode(parts)
  if (globResult) {
    decodedPathCache.set(encodedPath, globResult)
    return globResult
  }

  decodedPathCache.set(encodedPath, simpleDecode)
  return simpleDecode
}

export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, '-')
}

const HOME_DIR = process.env.HOME || ''

function isOutsideHome(projectPath: string): boolean {
  return !HOME_DIR || !projectPath.startsWith(HOME_DIR)
}

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean)
  return parts[parts.length - 1] || projectPath
}

function extractTextFromContent(content: ChatMessage['message']['content']): string {
  if (typeof content === 'string') {
    return content
  }
  const textBlock = content.find((block) => block.type === 'text')
  if (textBlock && 'text' in textBlock) {
    return textBlock.text
  }
  return ''
}

function isSystemMessage(message: ChatMessage): boolean {
  if (message.isMeta) return true

  const text = extractTextFromContent(message.message.content)
  if (text.startsWith('<command-name>')) return true
  if (text.startsWith('<local-command-')) return true
  if (text.startsWith('Caveat:')) return true

  return false
}

function parseTimestamp(timestamp: string | number): number {
  if (typeof timestamp === 'number') {
    return timestamp
  }
  const parsed = Date.parse(timestamp)
  return isNaN(parsed) ? 0 : parsed
}

function parseJsonlFile(filePath: string): ChatMessage[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())
    return lines
      .map((line) => {
        try {
          return JSON.parse(line) as ChatMessage
        } catch {
          return null
        }
      })
      .filter((msg): msg is ChatMessage => msg !== null)
      .filter((msg) => msg.type === 'user' || msg.type === 'assistant')
  } catch {
    return []
  }
}

function computeSessionTokens(messages: ChatMessage[]): TokenUsage | undefined {
  let input = 0,
    output = 0,
    cacheCreation = 0,
    cacheRead = 0
  let found = false

  for (const msg of messages) {
    const usage = msg.message.usage
    if (!usage) continue
    found = true
    input += usage.input_tokens || 0
    output += usage.output_tokens || 0
    cacheCreation += usage.cache_creation_input_tokens || 0
    cacheRead += usage.cache_read_input_tokens || 0
  }

  if (!found) return undefined

  return {
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: cacheCreation,
    cache_read_input_tokens: cacheRead,
  }
}

function getValidSessionFiles(projectDir: string): string[] {
  try {
    const files = fs.readdirSync(projectDir)
    return files.filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'))
  } catch {
    return []
  }
}

function parseFirstLines(filePath: string, maxLines: number): ChatMessage[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content
      .split('\n')
      .filter((line) => line.trim())
      .slice(0, maxLines)
    return lines
      .map((line) => {
        try {
          return JSON.parse(line) as ChatMessage
        } catch {
          return null
        }
      })
      .filter((msg): msg is ChatMessage => msg !== null)
      .filter((msg) => msg.type === 'user' || msg.type === 'assistant')
  } catch {
    return []
  }
}

function countVisibleMessages(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    let count = 0
    let start = 0

    while (start < content.length) {
      const end = content.indexOf('\n', start)
      const line = end === -1 ? content.slice(start) : content.slice(start, end)
      start = end === -1 ? content.length : end + 1

      if (!line.trim()) continue

      try {
        const msg = JSON.parse(line) as ChatMessage
        if (
          (msg.type === 'user' || msg.type === 'assistant') &&
          !isSystemMsg(msg) &&
          !hasNoVisibleContent(msg)
        ) {
          count++
        }
      } catch {
        continue
      }
    }

    return count
  } catch {
    return 0
  }
}

export interface ChatReaderDeps {
  projectsDir?: string
  archiveDir?: string
  decodeProjectPath?: (encoded: string) => string
  getProjectStats?: () => Map<string, { sessionCount: number; totalMessages: number }>
  getSessionSummariesFromDb?: (encodedPath: string) => {
    id: string
    firstMessage: string
    messageCount: number
    lastActivity: number
    isArchived?: boolean
  }[]
}

export type ChatReaderInstance = ReturnType<typeof createChatReader>

export function createChatReader(deps?: ChatReaderDeps) {
  const projectsDir = deps?.projectsDir ?? DEFAULT_PROJECTS_DIR
  const archiveDir = deps?.archiveDir ?? DEFAULT_ARCHIVE_DIR
  const decode = deps?.decodeProjectPath ?? decodeProjectPath
  const getStats = deps?.getProjectStats ?? defaultGetProjectStats
  const getDbSessions = deps?.getSessionSummariesFromDb ?? defaultGetSessionSummariesFromDb

  function resolveSessionFile(
    encodedProjectPath: string,
    sessionId: string,
  ): { filePath: string; isArchived: boolean } | null {
    const liveFile = path.join(projectsDir, encodedProjectPath, `${sessionId}.jsonl`)
    if (fs.existsSync(liveFile)) return { filePath: liveFile, isArchived: false }
    const archiveFile = path.join(archiveDir, encodedProjectPath, `${sessionId}.jsonl`)
    if (fs.existsSync(archiveFile)) return { filePath: archiveFile, isArchived: true }
    return null
  }

  function resolveSubagentDir(
    encodedProjectPath: string,
    sessionId: string,
  ): { dir: string; isArchived: boolean } | null {
    const liveDir = path.join(projectsDir, encodedProjectPath, sessionId, 'subagents')
    if (fs.existsSync(liveDir)) return { dir: liveDir, isArchived: false }
    const archiveSubDir = path.join(archiveDir, encodedProjectPath, sessionId, 'subagents')
    if (fs.existsSync(archiveSubDir)) return { dir: archiveSubDir, isArchived: true }
    return null
  }

  function listProjectEncodedPaths(): string[] {
    const seen = new Set<string>()
    const pushDirs = (root: string) => {
      if (!fs.existsSync(root)) return
      for (const name of fs.readdirSync(root)) {
        const full = path.join(root, name)
        try {
          if (fs.statSync(full).isDirectory()) seen.add(name)
        } catch {
          continue
        }
      }
    }
    pushDirs(projectsDir)
    pushDirs(archiveDir)
    return [...seen]
  }

  function resolveProjectDir(encodedPath: string): { dir: string; isArchived: boolean } | null {
    const liveDir = path.join(projectsDir, encodedPath)
    if (fs.existsSync(liveDir)) return { dir: liveDir, isArchived: false }
    const archDir = path.join(archiveDir, encodedPath)
    if (fs.existsSync(archDir)) return { dir: archDir, isArchived: true }
    return null
  }

  function getSessionsForProject(encodedPath: string): ChatSession[] {
    const sessionIds = new Map<string, { filePath: string; isArchived: boolean }>()

    const collect = (root: string, isArchived: boolean) => {
      const dir = path.join(root, encodedPath)
      if (!fs.existsSync(dir)) return
      try {
        for (const file of fs.readdirSync(dir)) {
          if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue
          const sessionId = file.replace('.jsonl', '')
          if (sessionIds.has(sessionId)) continue
          sessionIds.set(sessionId, { filePath: path.join(dir, file), isArchived })
        }
      } catch {
        // ignore unreadable dir
      }
    }

    collect(projectsDir, false)
    collect(archiveDir, true)

    const sessions: ChatSession[] = []
    for (const [sessionId, { filePath, isArchived }] of sessionIds) {
      const messages = parseJsonlFile(filePath)
      if (messages.length === 0) continue

      const firstUserMessage = messages.find((m) => m.type === 'user' && !isSystemMessage(m))
      const firstMessageText = firstUserMessage
        ? extractTextFromContent(firstUserMessage.message.content)
        : 'No messages'

      const timestamps = messages.map((m) => parseTimestamp(m.timestamp)).filter((t) => t > 0)
      const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : 0

      const projectPath = decode(encodedPath)
      const visibleCount = messages.filter((m) => !isSystemMsg(m) && !hasNoVisibleContent(m)).length
      const tokenUsage = computeSessionTokens(messages)

      sessions.push({
        id: sessionId,
        projectPath,
        projectName: extractProjectName(projectPath),
        encodedPath,
        messages,
        firstMessage: firstMessageText.slice(0, 500),
        lastActivity,
        messageCount: visibleCount,
        ...(tokenUsage && { tokenUsage }),
        ...(isArchived && { isArchived: true }),
      })
    }

    return sessions.sort((a, b) => b.lastActivity - a.lastActivity)
  }

  function getAllProjects(): Project[] {
    try {
      const projectDirs = listProjectEncodedPaths()

      return projectDirs
        .map((dir) => {
          const sessions = getSessionsForProject(dir)

          if (sessions.length === 0) {
            return null
          }

          const projectPath = decode(dir)
          const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0)
          const lastActivity = Math.max(...sessions.map((s) => s.lastActivity))

          return {
            path: projectPath,
            name: extractProjectName(projectPath),
            encodedPath: dir,
            sessions,
            totalMessages,
            lastActivity,
          }
        })
        .filter((project): project is Project => project !== null)
        .sort((a, b) => b.lastActivity - a.lastActivity)
    } catch {
      return []
    }
  }

  function getProjectByPath(encodedPath: string): Project | null {
    try {
      if (!resolveProjectDir(encodedPath)) {
        return null
      }

      const sessions = getSessionsForProject(encodedPath)

      if (sessions.length === 0) {
        return null
      }

      const projectPath = decode(encodedPath)
      const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0)
      const lastActivity = Math.max(...sessions.map((s) => s.lastActivity))

      return {
        path: projectPath,
        name: extractProjectName(projectPath),
        encodedPath,
        sessions,
        totalMessages,
        lastActivity,
      }
    } catch {
      return null
    }
  }

  function getProjectsSummary(): ProjectSummary[] {
    try {
      const projectDirs = listProjectEncodedPaths()
      const stats = getStats()

      return projectDirs
        .map((dir) => {
          const resolved = resolveProjectDir(dir)
          if (!resolved) return null

          const projectPath = decode(dir)

          if (!fs.existsSync(projectPath)) {
            return null
          }

          const outsideHome = isOutsideHome(projectPath)

          const liveFiles = fs.existsSync(path.join(projectsDir, dir))
            ? getValidSessionFiles(path.join(projectsDir, dir)).map((f) => ({
                filePath: path.join(projectsDir, dir, f),
              }))
            : []

          const liveSessionIds = new Set(
            liveFiles.map((f) => path.basename(f.filePath).replace('.jsonl', '')),
          )

          const archiveFiles = fs.existsSync(path.join(archiveDir, dir))
            ? getValidSessionFiles(path.join(archiveDir, dir))
                .filter((f) => !liveSessionIds.has(f.replace('.jsonl', '')))
                .map((f) => ({ filePath: path.join(archiveDir, dir, f) }))
            : []

          const allFiles = [...liveFiles, ...archiveFiles]
          if (allFiles.length === 0) {
            return null
          }

          const dbStats = stats.get(dir)

          let lastActivity = 0
          for (const { filePath } of allFiles) {
            try {
              const mtime = fs.statSync(filePath).mtime.getTime()
              if (mtime > lastActivity) lastActivity = mtime
            } catch {
              continue
            }
          }

          const hasMemory = fs.existsSync(path.join(projectsDir, dir, 'memory', 'MEMORY.md'))

          return {
            path: projectPath,
            name: extractProjectName(projectPath),
            encodedPath: dir,
            sessionCount: dbStats?.sessionCount ?? allFiles.length,
            totalMessages: dbStats?.totalMessages ?? 0,
            lastActivity,
            hasMemory,
            isOutsideHome: outsideHome,
          }
        })
        .filter((project): project is ProjectSummary => project !== null)
        .sort((a, b) => b.lastActivity - a.lastActivity)
    } catch {
      return []
    }
  }

  function getSessionsSummary(encodedPath: string): SessionSummary[] {
    const dbSessions = getDbSessions(encodedPath)
    if (dbSessions.length > 0) {
      return dbSessions.map((s) => ({ ...s, encodedPath }))
    }

    const seen = new Set<string>()
    const results: SessionSummary[] = []

    const collect = (root: string, isArchived: boolean) => {
      const dir = path.join(root, encodedPath)
      if (!fs.existsSync(dir)) return

      const sessionFiles = getValidSessionFiles(dir)
      for (const file of sessionFiles) {
        const sessionId = file.replace('.jsonl', '')
        if (seen.has(sessionId)) continue

        const filePath = path.join(dir, file)
        let fileStat: fs.Stats
        try {
          fileStat = fs.statSync(filePath)
        } catch {
          continue
        }

        if (fileStat.size === 0) continue

        const firstMessages = parseFirstLines(filePath, 100)
        if (firstMessages.length === 0) continue

        const firstUserMessage = firstMessages.find((m) => m.type === 'user' && !isSystemMessage(m))
        if (!firstUserMessage) continue

        const firstMessageText = extractTextFromContent(firstUserMessage.message.content)
        const visibleCount = countVisibleMessages(filePath)

        seen.add(sessionId)
        results.push({
          id: sessionId,
          encodedPath,
          firstMessage: firstMessageText.slice(0, 500),
          messageCount: visibleCount,
          lastActivity: fileStat.mtime.getTime(),
          ...(isArchived && { isArchived: true }),
        })
      }
    }

    collect(projectsDir, false)
    collect(archiveDir, true)

    return results.sort((a, b) => b.lastActivity - a.lastActivity)
  }

  function getSessionById(encodedProjectPath: string, sessionId: string): ChatSession | null {
    const resolved = resolveSessionFile(encodedProjectPath, sessionId)
    if (!resolved) return null

    try {
      const messages = parseJsonlFile(resolved.filePath)

      if (messages.length === 0) {
        return null
      }

      const firstUserMessage = messages.find((m) => m.type === 'user' && !isSystemMessage(m))
      const firstMessageText = firstUserMessage
        ? extractTextFromContent(firstUserMessage.message.content)
        : 'No messages'

      const timestamps = messages.map((m) => parseTimestamp(m.timestamp)).filter((t) => t > 0)
      const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : 0

      const projectPath = decode(encodedProjectPath)
      const visibleCount = messages.filter((m) => !isSystemMsg(m) && !hasNoVisibleContent(m)).length
      const tokenUsage = computeSessionTokens(messages)

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
        ...(resolved.isArchived && { isArchived: true }),
      }
    } catch {
      return null
    }
  }

  function getSubagentsForSession(
    encodedProjectPath: string,
    sessionId: string,
  ): SubagentSummary[] {
    const resolved = resolveSubagentDir(encodedProjectPath, sessionId)

    try {
      if (!resolved) return []

      const files = fs
        .readdirSync(resolved.dir)
        .filter((f) => f.startsWith('agent-') && f.endsWith('.jsonl'))

      return files
        .map((file) => {
          const agentId = file.replace('agent-', '').replace('.jsonl', '')
          const filePath = path.join(resolved.dir, file)
          const messages = parseJsonlFile(filePath)

          if (messages.length === 0) return null

          const firstUserMessage = messages.find((m) => m.type === 'user' && !isSystemMessage(m))
          const firstMessageText = firstUserMessage
            ? extractTextFromContent(firstUserMessage.message.content)
            : 'No messages'

          const timestamps = messages.map((m) => parseTimestamp(m.timestamp)).filter((t) => t > 0)
          const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : 0
          const visibleCount = messages.filter(
            (m) => !isSystemMsg(m) && !hasNoVisibleContent(m),
          ).length
          const slug = messages[0].slug ?? agentId

          return {
            agentId,
            slug,
            firstMessage: firstMessageText.slice(0, 500),
            messageCount: visibleCount,
            lastActivity,
          }
        })
        .filter((s): s is SubagentSummary => s !== null)
        .sort((a, b) => a.lastActivity - b.lastActivity)
    } catch {
      return []
    }
  }

  function getSubagentById(
    encodedProjectPath: string,
    sessionId: string,
    agentId: string,
  ): ChatSession | null {
    const resolved = resolveSubagentDir(encodedProjectPath, sessionId)
    if (!resolved) return null
    const filePath = path.join(resolved.dir, `agent-${agentId}.jsonl`)

    try {
      if (!fs.existsSync(filePath)) return null

      const messages = parseJsonlFile(filePath)

      if (messages.length === 0) return null

      const firstUserMessage = messages.find((m) => m.type === 'user' && !isSystemMessage(m))
      const firstMessageText = firstUserMessage
        ? extractTextFromContent(firstUserMessage.message.content)
        : 'No messages'

      const timestamps = messages.map((m) => parseTimestamp(m.timestamp)).filter((t) => t > 0)
      const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : 0

      const projectPath = decode(encodedProjectPath)
      const visibleCount = messages.filter((m) => !isSystemMsg(m) && !hasNoVisibleContent(m)).length
      const tokenUsage = computeSessionTokens(messages)
      const slug = messages[0].slug ?? agentId

      return {
        id: slug,
        projectPath,
        projectName: extractProjectName(projectPath),
        encodedPath: encodedProjectPath,
        messages,
        firstMessage: firstMessageText.slice(0, 500),
        lastActivity,
        messageCount: visibleCount,
        ...(tokenUsage && { tokenUsage }),
        ...(resolved.isArchived && { isArchived: true }),
      }
    } catch {
      return null
    }
  }

  return {
    getAllProjects,
    getProjectByPath,
    getProjectsSummary,
    getSessionsSummary,
    getSessionById,
    getSubagentsForSession,
    getSubagentById,
  }
}

let defaultInstance: ChatReaderInstance | null = null

function getDefault(): ChatReaderInstance {
  if (!defaultInstance) defaultInstance = createChatReader()
  return defaultInstance
}

export function getAllProjects() {
  return getDefault().getAllProjects()
}
export function getProjectByPath(encodedPath: string) {
  return getDefault().getProjectByPath(encodedPath)
}
export function getProjectsSummary() {
  return getDefault().getProjectsSummary()
}
export function getSessionsSummary(encodedPath: string) {
  return getDefault().getSessionsSummary(encodedPath)
}
export function getSessionById(encodedProjectPath: string, sessionId: string) {
  return getDefault().getSessionById(encodedProjectPath, sessionId)
}
export function getSubagentsForSession(encodedProjectPath: string, sessionId: string) {
  return getDefault().getSubagentsForSession(encodedProjectPath, sessionId)
}
export function getSubagentById(encodedProjectPath: string, sessionId: string, agentId: string) {
  return getDefault().getSubagentById(encodedProjectPath, sessionId, agentId)
}
