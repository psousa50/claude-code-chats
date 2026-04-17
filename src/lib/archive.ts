import fs from 'fs'
import path from 'path'

const CLAUDE_DIR = path.join(process.env.HOME || '', '.claude')
export const DEFAULT_LIVE_DIR = path.join(CLAUDE_DIR, 'projects')
export const DEFAULT_ARCHIVE_DIR = path.join(CLAUDE_DIR, 'chat-archive')

export interface ArchiveDeps {
  liveDir?: string
  archiveDir?: string
}

export interface ArchiveResult {
  copied: number
  skipped: number
}

export interface PruneResult {
  pruned: number
  bytesFreed: number
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024 * 1024
const ARCHIVE_MAX_SIZE_ENV = 'CC_CHATS_ARCHIVE_MAX_SIZE'

const SIZE_UNITS: Record<string, number> = {
  '': 1,
  b: 1,
  k: 1024,
  kb: 1024,
  m: 1024 ** 2,
  mb: 1024 ** 2,
  g: 1024 ** 3,
  gb: 1024 ** 3,
  t: 1024 ** 4,
  tb: 1024 ** 4,
}

export function parseSizeString(raw: string): number | null {
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/)
  if (!match) return null
  const value = Number(match[1])
  const multiplier = SIZE_UNITS[match[2].toLowerCase()]
  if (!Number.isFinite(value) || multiplier === undefined) return null
  return Math.floor(value * multiplier)
}

export function getArchiveMaxBytes(): number {
  const raw = process.env[ARCHIVE_MAX_SIZE_ENV]
  if (!raw) return DEFAULT_MAX_BYTES
  const parsed = parseSizeString(raw)
  if (parsed === null) {
    console.warn(
      `[cc-chats] Invalid ${ARCHIVE_MAX_SIZE_ENV}=${JSON.stringify(raw)}; falling back to default 5 GB`,
    )
    return DEFAULT_MAX_BYTES
  }
  return parsed
}

export function getArchiveDir(deps?: ArchiveDeps): string {
  return deps?.archiveDir ?? DEFAULT_ARCHIVE_DIR
}

export function getLiveDir(deps?: ArchiveDeps): string {
  return deps?.liveDir ?? DEFAULT_LIVE_DIR
}

export function mirrorLiveToArchive(deps?: ArchiveDeps): ArchiveResult {
  const liveDir = getLiveDir(deps)
  const archiveDir = getArchiveDir(deps)

  if (!fs.existsSync(liveDir)) return { copied: 0, skipped: 0 }

  fs.mkdirSync(archiveDir, { recursive: true })

  let copied = 0
  let skipped = 0

  for (const projectDirName of fs.readdirSync(liveDir)) {
    const liveProjectDir = path.join(liveDir, projectDirName)
    let liveStat: fs.Stats
    try {
      liveStat = fs.statSync(liveProjectDir)
    } catch {
      continue
    }
    if (!liveStat.isDirectory()) continue

    const archiveProjectDir = path.join(archiveDir, projectDirName)

    for (const entry of fs.readdirSync(liveProjectDir)) {
      const liveEntryPath = path.join(liveProjectDir, entry)
      let entryStat: fs.Stats
      try {
        entryStat = fs.statSync(liveEntryPath)
      } catch {
        continue
      }

      if (entryStat.isFile() && entry.endsWith('.jsonl')) {
        const archiveEntryPath = path.join(archiveProjectDir, entry)
        if (copyIfNewer(liveEntryPath, archiveEntryPath)) copied++
        else skipped++
        continue
      }

      if (entryStat.isDirectory()) {
        const liveSubagentDir = path.join(liveEntryPath, 'subagents')
        if (!fs.existsSync(liveSubagentDir)) continue

        const archiveSubagentDir = path.join(archiveProjectDir, entry, 'subagents')

        for (const subFile of fs.readdirSync(liveSubagentDir)) {
          if (!subFile.endsWith('.jsonl')) continue
          const liveSubPath = path.join(liveSubagentDir, subFile)
          const archiveSubPath = path.join(archiveSubagentDir, subFile)
          if (copyIfNewer(liveSubPath, archiveSubPath)) copied++
          else skipped++
        }
      }
    }
  }

  return { copied, skipped }
}

function copyIfNewer(src: string, dest: string): boolean {
  const srcStat = fs.statSync(src)

  if (fs.existsSync(dest)) {
    const destStat = fs.statSync(dest)
    if (destStat.mtime.getTime() >= srcStat.mtime.getTime() && destStat.size === srcStat.size) {
      return false
    }
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  fs.utimesSync(dest, srcStat.atime, srcStat.mtime)
  return true
}

export type RestoreOutcome = 'restored' | 'already-live' | 'not-archived'

export function restoreFromArchive(
  encodedPath: string,
  sessionId: string,
  deps?: ArchiveDeps,
): RestoreOutcome {
  const liveDir = getLiveDir(deps)
  const archiveDir = getArchiveDir(deps)

  const liveFile = path.join(liveDir, encodedPath, `${sessionId}.jsonl`)
  const archiveFile = path.join(archiveDir, encodedPath, `${sessionId}.jsonl`)

  if (fs.existsSync(liveFile)) return 'already-live'
  if (!fs.existsSync(archiveFile)) return 'not-archived'

  fs.mkdirSync(path.dirname(liveFile), { recursive: true })
  fs.copyFileSync(archiveFile, liveFile)
  const now = new Date()
  fs.utimesSync(liveFile, now, now)

  const archiveSubagentDir = path.join(archiveDir, encodedPath, sessionId, 'subagents')
  if (fs.existsSync(archiveSubagentDir)) {
    const liveSubagentDir = path.join(liveDir, encodedPath, sessionId, 'subagents')
    fs.mkdirSync(liveSubagentDir, { recursive: true })
    for (const file of fs.readdirSync(archiveSubagentDir)) {
      if (!file.endsWith('.jsonl')) continue
      fs.copyFileSync(path.join(archiveSubagentDir, file), path.join(liveSubagentDir, file))
    }
  }

  return 'restored'
}

interface ArchiveEntry {
  encodedPath: string
  sessionId: string
  mtime: number
  size: number
  jsonlPath: string
  sessionDir: string | null
  subagentPaths: string[]
}

function collectArchiveEntries(archiveDir: string): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []
  if (!fs.existsSync(archiveDir)) return entries

  for (const projName of fs.readdirSync(archiveDir)) {
    const projDir = path.join(archiveDir, projName)
    let projStat: fs.Stats
    try {
      projStat = fs.statSync(projDir)
    } catch {
      continue
    }
    if (!projStat.isDirectory()) continue

    for (const entry of fs.readdirSync(projDir)) {
      if (!entry.endsWith('.jsonl')) continue
      const jsonlPath = path.join(projDir, entry)
      let jsonlStat: fs.Stats
      try {
        jsonlStat = fs.statSync(jsonlPath)
      } catch {
        continue
      }
      if (!jsonlStat.isFile()) continue

      const sessionId = entry.replace('.jsonl', '')
      const sessionDir = path.join(projDir, sessionId)
      const subagentDir = path.join(sessionDir, 'subagents')
      const subagentPaths: string[] = []
      let size = jsonlStat.size

      if (fs.existsSync(subagentDir)) {
        for (const subFile of fs.readdirSync(subagentDir)) {
          if (!subFile.endsWith('.jsonl')) continue
          const subPath = path.join(subagentDir, subFile)
          try {
            size += fs.statSync(subPath).size
            subagentPaths.push(subPath)
          } catch {
            continue
          }
        }
      }

      entries.push({
        encodedPath: projName,
        sessionId,
        mtime: jsonlStat.mtime.getTime(),
        size,
        jsonlPath,
        sessionDir: fs.existsSync(sessionDir) ? sessionDir : null,
        subagentPaths,
      })
    }
  }

  return entries
}

export function pruneArchive(
  maxBytes: number = getArchiveMaxBytes(),
  deps?: ArchiveDeps,
): PruneResult {
  if (maxBytes <= 0) return { pruned: 0, bytesFreed: 0 }

  const liveDir = getLiveDir(deps)
  const archiveDir = getArchiveDir(deps)

  const entries = collectArchiveEntries(archiveDir)
  const total = entries.reduce((sum, e) => sum + e.size, 0)
  if (total <= maxBytes) return { pruned: 0, bytesFreed: 0 }

  entries.sort((a, b) => a.mtime - b.mtime)

  let remaining = total
  let pruned = 0
  let bytesFreed = 0

  for (const entry of entries) {
    if (remaining <= maxBytes) break

    const liveFile = path.join(liveDir, entry.encodedPath, `${entry.sessionId}.jsonl`)
    if (fs.existsSync(liveFile)) continue

    try {
      fs.unlinkSync(entry.jsonlPath)
    } catch {
      continue
    }
    for (const sub of entry.subagentPaths) {
      try {
        fs.unlinkSync(sub)
      } catch {
        continue
      }
    }
    if (entry.sessionDir && fs.existsSync(entry.sessionDir)) {
      try {
        fs.rmSync(entry.sessionDir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }

    pruned++
    bytesFreed += entry.size
    remaining -= entry.size
  }

  return { pruned, bytesFreed }
}

export function removeFromArchive(
  encodedPath: string,
  sessionId: string,
  deps?: ArchiveDeps,
): void {
  const archiveDir = getArchiveDir(deps)
  const archiveFile = path.join(archiveDir, encodedPath, `${sessionId}.jsonl`)
  const archiveSessionDir = path.join(archiveDir, encodedPath, sessionId)

  if (fs.existsSync(archiveFile)) {
    fs.unlinkSync(archiveFile)
  }

  if (fs.existsSync(archiveSessionDir)) {
    fs.rmSync(archiveSessionDir, { recursive: true, force: true })
  }
}
