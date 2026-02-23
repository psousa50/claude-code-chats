import { EventEmitter } from 'events'
import { describe, it, expect } from 'vitest'
import { createClaudeCli, type SpawnFn } from '../claude-cli'

function fakeProcess(stdout: string, exitCode: number) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    stdin: { end: () => void }
  }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.stdin = { end: () => {} }

  setTimeout(() => {
    proc.stdout.emit('data', Buffer.from(stdout))
    proc.emit('close', exitCode)
  }, 0)

  return proc
}

function fakeErrorProcess(message: string) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    stdin: { end: () => void }
  }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.stdin = { end: () => {} }

  setTimeout(() => {
    proc.emit('error', new Error(message))
  }, 0)

  return proc
}

function fakeStderrProcess(stderr: string, exitCode: number) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    stdin: { end: () => void }
  }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.stdin = { end: () => {} }

  setTimeout(() => {
    proc.stderr.emit('data', Buffer.from(stderr))
    proc.emit('close', exitCode)
  }, 0)

  return proc
}

describe('generateSessionSummary', () => {
  it('returns success with result text', async () => {
    const spawnFn = (() =>
      fakeProcess('Fixed a login bug in the auth module.', 0)) as unknown as SpawnFn
    const cli = createClaudeCli({ spawnFn })

    const response = await cli.generateSessionSummary('- Fix the login bug\n- Add validation')
    expect(response.success).toBe(true)
    expect(response.output).toBe('Fixed a login bug in the auth module.')
  })

  it('trims whitespace from result', async () => {
    const spawnFn = (() => fakeProcess('  trimmed result  ', 0)) as unknown as SpawnFn
    const cli = createClaudeCli({ spawnFn })

    const response = await cli.generateSessionSummary('test')
    expect(response.output).toBe('trimmed result')
  })

  it('returns error when spawn fails', async () => {
    const spawnFn = (() => fakeErrorProcess('command not found')) as unknown as SpawnFn
    const cli = createClaudeCli({ spawnFn })

    const response = await cli.generateSessionSummary('test')
    expect(response.success).toBe(false)
    expect(response.error).toContain('command not found')
  })

  it('returns error on non-zero exit code', async () => {
    const spawnFn = (() => fakeStderrProcess('something went wrong', 1)) as unknown as SpawnFn
    const cli = createClaudeCli({ spawnFn })

    const response = await cli.generateSessionSummary('test')
    expect(response.success).toBe(false)
    expect(response.error).toContain('something went wrong')
  })
})

describe('generateProjectSummary', () => {
  it('returns success with summary text', async () => {
    const spawnFn = (() =>
      fakeProcess('A web app for managing chat history.', 0)) as unknown as SpawnFn
    const cli = createClaudeCli({ spawnFn })

    const response = await cli.generateProjectSummary(['Fixed auth bugs', 'Added dark mode'])
    expect(response.success).toBe(true)
    expect(response.output).toBe('A web app for managing chat history.')
  })

  it('returns error on non-zero exit code', async () => {
    const spawnFn = (() => fakeStderrProcess('timeout', 1)) as unknown as SpawnFn
    const cli = createClaudeCli({ spawnFn })

    const response = await cli.generateProjectSummary(['summary 1'])
    expect(response.success).toBe(false)
    expect(response.error).toContain('timeout')
  })
})
