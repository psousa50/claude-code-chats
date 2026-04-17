import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
  statSync,
  utimesSync,
} from 'fs'
import path from 'path'
import os from 'os'
import {
  mirrorLiveToArchive,
  parseSizeString,
  pruneArchive,
  removeFromArchive,
  restoreFromArchive,
} from '../archive'

let tmpDir: string
let liveDir: string
let archiveDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'archive-test-'))
  liveDir = path.join(tmpDir, 'projects')
  archiveDir = path.join(tmpDir, 'archive')
  mkdirSync(liveDir, { recursive: true })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeLiveSession(proj: string, sessionId: string, body: string): string {
  const dir = path.join(liveDir, proj)
  mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${sessionId}.jsonl`)
  writeFileSync(filePath, body, 'utf-8')
  return filePath
}

describe('mirrorLiveToArchive', () => {
  it('returns zero counts when live dir does not exist', () => {
    rmSync(liveDir, { recursive: true })
    expect(mirrorLiveToArchive({ liveDir, archiveDir })).toEqual({ copied: 0, skipped: 0 })
  })

  it('copies new jsonl files to archive', () => {
    writeLiveSession('proj', 's1', 'message1\n')
    writeLiveSession('proj', 's2', 'message2\n')

    const result = mirrorLiveToArchive({ liveDir, archiveDir })
    expect(result.copied).toBe(2)

    expect(readFileSync(path.join(archiveDir, 'proj', 's1.jsonl'), 'utf-8')).toBe('message1\n')
    expect(readFileSync(path.join(archiveDir, 'proj', 's2.jsonl'), 'utf-8')).toBe('message2\n')
  })

  it('skips files already archived with same mtime and size', () => {
    writeLiveSession('proj', 's1', 'unchanged')
    mirrorLiveToArchive({ liveDir, archiveDir })

    const second = mirrorLiveToArchive({ liveDir, archiveDir })
    expect(second).toEqual({ copied: 0, skipped: 1 })
  })

  it('re-copies when live file is newer', () => {
    const live = writeLiveSession('proj', 's1', 'v1')
    mirrorLiveToArchive({ liveDir, archiveDir })

    const future = new Date(Date.now() + 10000)
    writeFileSync(live, 'v2-longer')
    utimesSync(live, future, future)

    const result = mirrorLiveToArchive({ liveDir, archiveDir })
    expect(result.copied).toBe(1)
    expect(readFileSync(path.join(archiveDir, 'proj', 's1.jsonl'), 'utf-8')).toBe('v2-longer')
  })

  it('preserves source mtime on archived copy', () => {
    const live = writeLiveSession('proj', 's1', 'data')
    const fixedMtime = new Date('2026-02-01T12:00:00Z')
    utimesSync(live, fixedMtime, fixedMtime)

    mirrorLiveToArchive({ liveDir, archiveDir })

    const archivedStat = statSync(path.join(archiveDir, 'proj', 's1.jsonl'))
    expect(archivedStat.mtime.getTime()).toBe(fixedMtime.getTime())
  })

  it('copies subagent jsonl files under session subdirectories', () => {
    writeLiveSession('proj', 's1', 'session')
    const subagentDir = path.join(liveDir, 'proj', 's1', 'subagents')
    mkdirSync(subagentDir, { recursive: true })
    writeFileSync(path.join(subagentDir, 'agent-abc.jsonl'), 'agent-data')

    mirrorLiveToArchive({ liveDir, archiveDir })

    expect(
      readFileSync(path.join(archiveDir, 'proj', 's1', 'subagents', 'agent-abc.jsonl'), 'utf-8'),
    ).toBe('agent-data')
  })

  it('ignores non-jsonl files', () => {
    const projectDir = path.join(liveDir, 'proj')
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(path.join(projectDir, 'notes.txt'), 'not a session')
    writeFileSync(path.join(projectDir, 'memory'), 'not a dir')

    const result = mirrorLiveToArchive({ liveDir, archiveDir })
    expect(result.copied).toBe(0)
    expect(existsSync(path.join(archiveDir, 'proj', 'notes.txt'))).toBe(false)
  })
})

describe('restoreFromArchive', () => {
  it('returns not-archived when no archive copy exists', () => {
    expect(restoreFromArchive('missing', 'missing', { liveDir, archiveDir })).toBe('not-archived')
  })

  it('returns already-live when live file still exists', () => {
    writeLiveSession('proj', 's1', 'live-data')
    mirrorLiveToArchive({ liveDir, archiveDir })

    expect(restoreFromArchive('proj', 's1', { liveDir, archiveDir })).toBe('already-live')
  })

  it('copies archive jsonl back to live when live is gone', () => {
    const live = writeLiveSession('proj', 's1', 'original-content')
    mirrorLiveToArchive({ liveDir, archiveDir })
    rmSync(live)

    expect(restoreFromArchive('proj', 's1', { liveDir, archiveDir })).toBe('restored')
    expect(readFileSync(live, 'utf-8')).toBe('original-content')
  })

  it('resets mtime to now on the restored file', () => {
    const live = writeLiveSession('proj', 's1', 'data')
    const oldMtime = new Date('2026-02-01T12:00:00Z')
    utimesSync(live, oldMtime, oldMtime)
    mirrorLiveToArchive({ liveDir, archiveDir })
    rmSync(live)

    const before = Date.now()
    restoreFromArchive('proj', 's1', { liveDir, archiveDir })
    const restoredMtime = statSync(live).mtime.getTime()

    expect(restoredMtime).toBeGreaterThanOrEqual(before)
    expect(restoredMtime).not.toBe(oldMtime.getTime())
  })

  it('restores subagent jsonl files alongside the session', () => {
    writeLiveSession('proj', 's1', 'session')
    const liveSubagents = path.join(liveDir, 'proj', 's1', 'subagents')
    mkdirSync(liveSubagents, { recursive: true })
    writeFileSync(path.join(liveSubagents, 'agent-abc.jsonl'), 'agent-body')

    mirrorLiveToArchive({ liveDir, archiveDir })
    rmSync(path.join(liveDir, 'proj'), { recursive: true })

    restoreFromArchive('proj', 's1', { liveDir, archiveDir })

    expect(readFileSync(path.join(liveDir, 'proj', 's1.jsonl'), 'utf-8')).toBe('session')
    expect(readFileSync(path.join(liveSubagents, 'agent-abc.jsonl'), 'utf-8')).toBe('agent-body')
  })
})

describe('parseSizeString', () => {
  const cases: Array<[string, number | null]> = [
    ['0', 0],
    ['1024', 1024],
    ['5GB', 5 * 1024 ** 3],
    ['5gb', 5 * 1024 ** 3],
    ['5 GB', 5 * 1024 ** 3],
    ['500MB', 500 * 1024 ** 2],
    ['1.5gb', Math.floor(1.5 * 1024 ** 3)],
    ['2K', 2 * 1024],
    ['3t', 3 * 1024 ** 4],
    ['100B', 100],
    ['', null],
    ['   ', null],
    ['5XX', null],
    ['abc', null],
    ['GB', null],
  ]

  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)} → ${expected}`, () => {
      expect(parseSizeString(input)).toBe(expected)
    })
  }
})

describe('pruneArchive', () => {
  function writeArchivedOnly(proj: string, sessionId: string, body: string, mtime: Date): number {
    const live = writeLiveSession(proj, sessionId, body)
    utimesSync(live, mtime, mtime)
    mirrorLiveToArchive({ liveDir, archiveDir })
    rmSync(live)
    return statSync(path.join(archiveDir, proj, `${sessionId}.jsonl`)).size
  }

  it('returns zero counts when archive is empty', () => {
    expect(pruneArchive(1_000_000, { liveDir, archiveDir })).toEqual({ pruned: 0, bytesFreed: 0 })
  })

  it('skips pruning when archive is under cap', () => {
    writeArchivedOnly('proj', 's1', 'x'.repeat(100), new Date('2026-01-01'))
    const result = pruneArchive(10_000, { liveDir, archiveDir })
    expect(result).toEqual({ pruned: 0, bytesFreed: 0 })
  })

  it('prunes oldest archived sessions until under cap', () => {
    writeArchivedOnly('proj', 'old', 'x'.repeat(500), new Date('2026-01-01'))
    writeArchivedOnly('proj', 'mid', 'x'.repeat(500), new Date('2026-02-01'))
    writeArchivedOnly('proj', 'new', 'x'.repeat(500), new Date('2026-03-01'))

    const result = pruneArchive(800, { liveDir, archiveDir })

    expect(result.pruned).toBe(2)
    expect(result.bytesFreed).toBeGreaterThanOrEqual(1000)
    expect(existsSync(path.join(archiveDir, 'proj', 'old.jsonl'))).toBe(false)
    expect(existsSync(path.join(archiveDir, 'proj', 'mid.jsonl'))).toBe(false)
    expect(existsSync(path.join(archiveDir, 'proj', 'new.jsonl'))).toBe(true)
  })

  it('does not prune archive entries whose live copy still exists', () => {
    // 'keep' is still live; 'old' is archive-only and older
    writeArchivedOnly('proj', 'old', 'x'.repeat(500), new Date('2026-01-01'))
    writeLiveSession('proj', 'keep', 'x'.repeat(500))
    mirrorLiveToArchive({ liveDir, archiveDir })

    const result = pruneArchive(100, { liveDir, archiveDir })

    expect(existsSync(path.join(archiveDir, 'proj', 'keep.jsonl'))).toBe(true)
    expect(existsSync(path.join(archiveDir, 'proj', 'old.jsonl'))).toBe(false)
    expect(result.pruned).toBe(1)
  })

  it('prunes the subagent directory alongside its session', () => {
    const live = writeLiveSession('proj', 's1', 'data')
    const liveSubagents = path.join(liveDir, 'proj', 's1', 'subagents')
    mkdirSync(liveSubagents, { recursive: true })
    writeFileSync(path.join(liveSubagents, 'agent-abc.jsonl'), 'x'.repeat(500))
    const oldDate = new Date('2026-01-01')
    utimesSync(live, oldDate, oldDate)

    mirrorLiveToArchive({ liveDir, archiveDir })
    rmSync(path.join(liveDir, 'proj'), { recursive: true })

    pruneArchive(10, { liveDir, archiveDir })

    expect(existsSync(path.join(archiveDir, 'proj', 's1.jsonl'))).toBe(false)
    expect(existsSync(path.join(archiveDir, 'proj', 's1'))).toBe(false)
  })

  it('is a no-op when cap is zero (disabled)', () => {
    writeArchivedOnly('proj', 's1', 'x'.repeat(500), new Date('2026-01-01'))
    const result = pruneArchive(0, { liveDir, archiveDir })
    expect(result).toEqual({ pruned: 0, bytesFreed: 0 })
    expect(existsSync(path.join(archiveDir, 'proj', 's1.jsonl'))).toBe(true)
  })
})

describe('removeFromArchive', () => {
  it('removes jsonl and session subdirectory from archive', () => {
    writeLiveSession('proj', 's1', 'data')
    const subagentDir = path.join(liveDir, 'proj', 's1', 'subagents')
    mkdirSync(subagentDir, { recursive: true })
    writeFileSync(path.join(subagentDir, 'agent-abc.jsonl'), 'agent')

    mirrorLiveToArchive({ liveDir, archiveDir })
    expect(existsSync(path.join(archiveDir, 'proj', 's1.jsonl'))).toBe(true)

    removeFromArchive('proj', 's1', { archiveDir })

    expect(existsSync(path.join(archiveDir, 'proj', 's1.jsonl'))).toBe(false)
    expect(existsSync(path.join(archiveDir, 'proj', 's1'))).toBe(false)
  })

  it('is a no-op when archive has no copy', () => {
    expect(() => removeFromArchive('missing-project', 'missing', { archiveDir })).not.toThrow()
  })
})
