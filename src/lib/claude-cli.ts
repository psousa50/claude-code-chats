import { query } from '@anthropic-ai/claude-agent-sdk'
import { execSync } from 'child_process'

export interface ClaudeResponse {
  success: boolean
  output: string
  error?: string
}

function findClaudeExecutable(): string {
  try {
    return execSync('which claude', { encoding: 'utf-8' }).trim()
  } catch {
    return 'claude'
  }
}

function logClaudeVersion(executable: string): void {
  try {
    const version = execSync(`${executable} --version`, { encoding: 'utf-8' }).trim()
    console.log(`[claude-cli] ${executable} (${version})`)
  } catch {
    console.warn(`[claude-cli] ${executable} (version unknown)`)
  }
}

export type QueryFn = typeof query

export interface ClaudeCliDeps {
  queryFn?: QueryFn
  claudeExecutable?: string
}

export type ClaudeCliInstance = ReturnType<typeof createClaudeCli>

export function createClaudeCli(deps?: ClaudeCliDeps) {
  const queryFn = deps?.queryFn ?? query
  const executable = deps?.claudeExecutable ?? findClaudeExecutable()

  if (!deps?.claudeExecutable && !deps?.queryFn) {
    logClaudeVersion(executable)
  }

  async function invokeClaude(prompt: string): Promise<ClaudeResponse> {
    const stderrChunks: string[] = []

    try {
      let result = ''

      for await (const message of queryFn({
        prompt,
        options: {
          allowedTools: [],
          maxTurns: 1,
          pathToClaudeCodeExecutable: executable,
          stderr: (data: string) => stderrChunks.push(data),
        },
      })) {
        if ('result' in message) {
          result = message.result as string
        }
      }

      if (!result) {
        return { success: false, output: '', error: 'No result returned' }
      }

      return { success: true, output: result.trim() }
    } catch (error) {
      const stderr = stderrChunks.join('').trim()
      const message = error instanceof Error ? error.message : 'Unknown error'
      const detail = stderr ? `${message} — stderr: ${stderr}` : message
      console.error('[claude-cli]', detail)
      return { success: false, output: '', error: detail }
    }
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
