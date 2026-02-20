import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildPairs,
  samplePairs,
  truncateAssistant,
  formatConversationForSummary,
} from '../summary-format'
import {
  makeUserMessage,
  makeAssistantMessage,
  makeAssistantMessageWithBlocks,
  makeSystemMessage,
  makeChatMessage,
  resetUuidCounter,
} from './helpers'

beforeEach(() => {
  resetUuidCounter()
})

describe('truncateAssistant', () => {
  it('returns short text unchanged', () => {
    expect(truncateAssistant('short text', 200)).toBe('short text')
  })

  it('returns text at exact limit unchanged', () => {
    const text = 'a'.repeat(200)
    expect(truncateAssistant(text, 200)).toBe(text)
  })

  it('applies head+tail for text exceeding limit', () => {
    const text = 'A'.repeat(50) + 'B'.repeat(200) + 'C'.repeat(50)
    const result = truncateAssistant(text, 200)
    expect(result).toContain(' [...] ')
    expect(result.length).toBeLessThanOrEqual(200)
    expect(result.startsWith('A')).toBe(true)
    expect(result.endsWith('C')).toBe(true)
  })
})

describe('buildPairs', () => {
  it('pairs user message with following assistant message', () => {
    const messages = [
      makeUserMessage('fix the bug'),
      makeAssistantMessage('I fixed the auth middleware.'),
    ]
    const pairs = buildPairs(messages)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].user).toBe('fix the bug')
    expect(pairs[0].assistant).toBe('I fixed the auth middleware.')
  })

  it('combines consecutive assistant messages into one pair', () => {
    const messages = [
      makeUserMessage('help'),
      makeAssistantMessage('First response.'),
      makeAssistantMessage('Second response.'),
    ]
    const pairs = buildPairs(messages)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].assistant).toBe('First response.\nSecond response.')
  })

  it('creates pair with empty assistant when no response follows', () => {
    const messages = [makeUserMessage('hello')]
    const pairs = buildPairs(messages)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].user).toBe('hello')
    expect(pairs[0].assistant).toBe('')
  })

  it('filters out system messages', () => {
    const messages = [
      makeSystemMessage('system init'),
      makeUserMessage('fix the bug'),
      makeAssistantMessage('Done.'),
    ]
    const pairs = buildPairs(messages)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].user).toBe('fix the bug')
  })

  it('filters out sidechain messages', () => {
    const messages = [
      makeUserMessage('main request'),
      makeUserMessage('sidechain request', { isSidechain: true }),
      makeAssistantMessage('main response'),
    ]
    const pairs = buildPairs(messages)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].user).toBe('main request')
    expect(pairs[0].assistant).toBe('main response')
  })

  it('filters out file-history-snapshot messages', () => {
    const messages = [
      makeChatMessage({ type: 'file-history-snapshot' }),
      makeUserMessage('do something'),
      makeAssistantMessage('Done.'),
    ]
    const pairs = buildPairs(messages)
    expect(pairs).toHaveLength(1)
  })

  it('extracts all text blocks from assistant messages', () => {
    const messages = [
      makeUserMessage('refactor auth'),
      makeAssistantMessageWithBlocks([
        { type: 'text', text: "I'll refactor the auth module." },
        { type: 'tool_use', id: 't1', name: 'Edit', input: {} },
        { type: 'tool_result', tool_use_id: 't1', content: 'edited' },
        { type: 'text', text: 'Refactored auth to use JWT tokens.' },
      ]),
    ]
    const pairs = buildPairs(messages)
    expect(pairs[0].assistant).toBe(
      "I'll refactor the auth module.\nRefactored auth to use JWT tokens.",
    )
  })

  it('skips orphan assistant messages at start', () => {
    const messages = [
      makeAssistantMessage('orphan'),
      makeUserMessage('real question'),
      makeAssistantMessage('real answer'),
    ]
    const pairs = buildPairs(messages)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].user).toBe('real question')
  })

  it('skips pairs where both user and assistant are empty', () => {
    const messages = [
      makeUserMessage(''),
      makeAssistantMessageWithBlocks([{ type: 'tool_use', id: 't1', name: 'Read', input: {} }]),
    ]
    const pairs = buildPairs(messages)
    expect(pairs).toHaveLength(0)
  })

  it('handles multiple user-assistant exchanges', () => {
    const messages = [
      makeUserMessage('first question'),
      makeAssistantMessage('first answer'),
      makeUserMessage('second question'),
      makeAssistantMessage('second answer'),
      makeUserMessage('third question'),
      makeAssistantMessage('third answer'),
    ]
    const pairs = buildPairs(messages)
    expect(pairs).toHaveLength(3)
    expect(pairs[0].user).toBe('first question')
    expect(pairs[1].user).toBe('second question')
    expect(pairs[2].user).toBe('third question')
  })
})

describe('samplePairs', () => {
  function makePairs(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      user: `user-${i}`,
      assistant: `assistant-${i}`,
    }))
  }

  it('returns all pairs when 10 or fewer', () => {
    const pairs = makePairs(10)
    expect(samplePairs(pairs)).toHaveLength(10)
  })

  it('returns all pairs when exactly 1', () => {
    const pairs = makePairs(1)
    expect(samplePairs(pairs)).toEqual(pairs)
  })

  it('samples for 15 pairs: first 2 + 6 middle + last 2', () => {
    const pairs = makePairs(15)
    const sampled = samplePairs(pairs)
    expect(sampled).toHaveLength(10)
    expect(sampled[0].user).toBe('user-0')
    expect(sampled[1].user).toBe('user-1')
    expect(sampled[sampled.length - 2].user).toBe('user-13')
    expect(sampled[sampled.length - 1].user).toBe('user-14')
  })

  it('samples for 30 pairs: first 2 + 8 middle + last 2', () => {
    const pairs = makePairs(30)
    const sampled = samplePairs(pairs)
    expect(sampled).toHaveLength(12)
    expect(sampled[0].user).toBe('user-0')
    expect(sampled[1].user).toBe('user-1')
    expect(sampled[sampled.length - 1].user).toBe('user-29')
  })

  it('samples for 50 pairs: first 2 + 10 middle + last 2', () => {
    const pairs = makePairs(50)
    const sampled = samplePairs(pairs)
    expect(sampled).toHaveLength(14)
  })

  it('always includes first and last pairs', () => {
    const pairs = makePairs(25)
    const sampled = samplePairs(pairs)
    expect(sampled[0]).toEqual(pairs[0])
    expect(sampled[1]).toEqual(pairs[1])
    expect(sampled[sampled.length - 2]).toEqual(pairs[23])
    expect(sampled[sampled.length - 1]).toEqual(pairs[24])
  })

  it('distributes middle samples evenly', () => {
    const pairs = makePairs(20)
    const sampled = samplePairs(pairs)
    const middleIndices = sampled.slice(2, -2).map((p) => parseInt(p.user.split('-')[1]))
    for (let i = 1; i < middleIndices.length; i++) {
      const gap = middleIndices[i] - middleIndices[i - 1]
      expect(gap).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('formatConversationForSummary', () => {
  it('formats a simple exchange', () => {
    const messages = [
      makeUserMessage('add dark mode'),
      makeAssistantMessage('Added dark mode toggle using CSS custom properties.'),
    ]
    const result = formatConversationForSummary(messages)
    expect(result).toContain('> User: add dark mode')
    expect(result).toContain('Assistant: Added dark mode toggle using CSS custom properties.')
  })

  it('truncates long user messages to 300 chars', () => {
    const longText = 'x'.repeat(500)
    const messages = [makeUserMessage(longText), makeAssistantMessage('Done.')]
    const result = formatConversationForSummary(messages)
    expect(result).toContain('x'.repeat(300) + '...')
  })

  it('applies head+tail truncation for long assistant text', () => {
    const longText = 'A'.repeat(300)
    const messages = [makeUserMessage('do something'), makeAssistantMessage(longText)]
    const result = formatConversationForSummary(messages)
    expect(result).toContain('[...]')
  })

  it('omits assistant line when assistant text is empty', () => {
    const messages = [
      makeUserMessage('hello'),
      makeAssistantMessageWithBlocks([{ type: 'tool_use', id: 't1', name: 'Read', input: {} }]),
    ]
    const result = formatConversationForSummary(messages)
    expect(result).toContain('> User: hello')
    expect(result).not.toContain('Assistant:')
  })

  it('respects total character budget', () => {
    const messages: ReturnType<typeof makeUserMessage>[] = []
    for (let i = 0; i < 100; i++) {
      messages.push(makeUserMessage(`request number ${i} with some detail ${'x'.repeat(200)}`))
      messages.push(makeAssistantMessage(`response number ${i} ${'y'.repeat(150)}`))
    }
    const result = formatConversationForSummary(messages)
    expect(result.length).toBeLessThanOrEqual(12000)
  })

  it('handles empty message list', () => {
    expect(formatConversationForSummary([])).toBe('')
  })

  it('handles session with only system messages', () => {
    const messages = [makeSystemMessage('init'), makeSystemMessage('config')]
    expect(formatConversationForSummary(messages)).toBe('')
  })
})
