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
