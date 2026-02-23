import { spawn, type ChildProcess } from 'child_process'

export interface ClaudeResponse {
  success: boolean
  output: string
  error?: string
}

export type SpawnFn = (command: string, args: string[]) => ChildProcess

export interface ClaudeCliDeps {
  spawnFn?: SpawnFn
}

export type ClaudeCliInstance = ReturnType<typeof createClaudeCli>

export function createClaudeCli(deps?: ClaudeCliDeps) {
  const spawnFn =
    deps?.spawnFn ?? ((cmd: string, args: string[]) => spawn(cmd, args, { timeout: 120000 }))

  function invokeClaude(prompt: string): Promise<ClaudeResponse> {
    return new Promise((resolve) => {
      const child = spawnFn('claude', ['-p', prompt, '--output-format', 'text'])

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('error', (error: Error) => {
        resolve({ success: false, output: '', error: `Failed to spawn claude: ${error.message}` })
      })

      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve({ success: true, output: stdout.trim() })
        } else {
          resolve({
            success: false,
            output: stdout.trim(),
            error: stderr || `Process exited with code ${code}`,
          })
        }
      })

      child.stdin?.end()
    })
  }

  async function generateSessionSummary(conversationText: string): Promise<ClaudeResponse> {
    const prompt = `Summarise this Claude Code session in 2-3 sentences. Focus on what was actually built, fixed, or changed — not just what was requested. Be specific about technologies, files, or features involved.

Conversation (user requests paired with assistant responses):
${conversationText}`

    return invokeClaude(prompt)
  }

  async function generateProjectSummary(sessionSummaries: string[]): Promise<ClaudeResponse> {
    const summariesText = sessionSummaries.map((s, i) => `Session ${i + 1}: ${s}`).join('\n')

    const prompt = `Given these session summaries from a coding project, provide a brief 2-3 sentence overview of what this project involves and recent activity.

${summariesText}`

    return invokeClaude(prompt)
  }

  return {
    generateSessionSummary,
    generateProjectSummary,
  }
}

let defaultInstance: ClaudeCliInstance | null = null

function getDefault(): ClaudeCliInstance {
  if (!defaultInstance) defaultInstance = createClaudeCli()
  return defaultInstance
}

export async function generateSessionSummary(conversationText: string) {
  return getDefault().generateSessionSummary(conversationText)
}

export async function generateProjectSummary(sessionSummaries: string[]) {
  return getDefault().generateProjectSummary(sessionSummaries)
}
