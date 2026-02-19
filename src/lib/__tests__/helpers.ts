import fs from 'fs'
import path from 'path'
import { ChatMessage, ContentBlock } from '../types'

let uuidCounter = 0

function nextUuid(): string {
  uuidCounter++
  return `00000000-0000-0000-0000-${String(uuidCounter).padStart(12, '0')}`
}

export function resetUuidCounter(): void {
  uuidCounter = 0
}

const BASE_TIMESTAMP = new Date('2026-01-15T10:00:00Z').getTime()

export function makeChatMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  const uuid = nextUuid()
  return {
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/tmp/test-project',
    sessionId: 'test-session-1',
    version: '1.0.0',
    gitBranch: 'main',
    type: 'user',
    message: {
      role: 'user',
      content: 'Hello, world!',
    },
    uuid,
    timestamp: BASE_TIMESTAMP,
    ...overrides,
  }
}

export function makeUserMessage(text: string, overrides?: Partial<ChatMessage>): ChatMessage {
  return makeChatMessage({
    type: 'user',
    message: { role: 'user', content: text },
    ...overrides,
  })
}

export function makeAssistantMessage(text: string, overrides?: Partial<ChatMessage>): ChatMessage {
  return makeChatMessage({
    type: 'assistant',
    message: { role: 'assistant', content: text },
    ...overrides,
  })
}

export function makeAssistantMessageWithBlocks(
  blocks: ContentBlock[],
  overrides?: Partial<ChatMessage>,
): ChatMessage {
  return makeChatMessage({
    type: 'assistant',
    message: { role: 'assistant', content: blocks },
    ...overrides,
  })
}

export function makeSystemMessage(text: string): ChatMessage {
  return makeChatMessage({
    type: 'user',
    isMeta: true,
    message: { role: 'user', content: text },
  })
}

export function makeMessageWithUsage(
  text: string,
  usage: { input: number; output: number; cacheCreation?: number; cacheRead?: number },
): ChatMessage {
  return makeChatMessage({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: text,
      usage: {
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_creation_input_tokens: usage.cacheCreation ?? 0,
        cache_read_input_tokens: usage.cacheRead ?? 0,
      },
    },
  })
}

export function toJsonl(messages: ChatMessage[]): string {
  return messages.map((m) => JSON.stringify(m)).join('\n') + '\n'
}

export function writeTempProject(
  baseDir: string,
  encodedPath: string,
  sessions: Record<string, string>,
): string {
  const projectDir = path.join(baseDir, encodedPath)
  fs.mkdirSync(projectDir, { recursive: true })

  for (const [sessionId, content] of Object.entries(sessions)) {
    fs.writeFileSync(path.join(projectDir, `${sessionId}.jsonl`), content, 'utf-8')
  }

  return projectDir
}
