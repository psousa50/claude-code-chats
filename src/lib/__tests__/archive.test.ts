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
import { mirrorLiveToArchive, removeFromArchive } from '../archive'

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
