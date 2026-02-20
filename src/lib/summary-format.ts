import { ChatMessage } from './types'
import { extractAllTextFromContent, isSystemMessage } from './message-utils'

interface ConversationPair {
  user: string
  assistant: string
}

const MAX_TOTAL = 12000
const MAX_USER = 300
const MAX_ASSISTANT = 200

export function truncateAssistant(text: string, limit: number): string {
  if (text.length <= limit) return text
  const half = Math.floor((limit - 7) / 2)
  return text.slice(0, half) + ' [...] ' + text.slice(-half)
}

export function buildPairs(messages: ChatMessage[]): ConversationPair[] {
  const meaningful = messages.filter(
    (m) => !isSystemMessage(m) && !m.isSidechain && m.type !== 'file-history-snapshot',
  )

  const pairs: ConversationPair[] = []
  let i = 0

  while (i < meaningful.length) {
    if (meaningful[i].type === 'user') {
      const userText = extractAllTextFromContent(meaningful[i].message.content).trim()

      let assistantText = ''
      let j = i + 1
      while (j < meaningful.length && meaningful[j].type === 'assistant') {
        const text = extractAllTextFromContent(meaningful[j].message.content).trim()
        if (text) {
          assistantText += (assistantText ? '\n' : '') + text
        }
        j++
      }

      if (userText || assistantText) {
        pairs.push({ user: userText, assistant: assistantText })
      }
      i = j
    } else {
      i++
    }
  }

  return pairs
}

export function samplePairs(pairs: ConversationPair[]): ConversationPair[] {
  if (pairs.length <= 10) return pairs

  const first = pairs.slice(0, 2)
  const last = pairs.slice(-2)

  const middle = pairs.slice(2, -2)
  const maxMiddle = pairs.length <= 20 ? 6 : pairs.length <= 40 ? 8 : 10
  const step = middle.length / maxMiddle

  const sampled: ConversationPair[] = []
  for (let i = 0; i < maxMiddle && i * step < middle.length; i++) {
    sampled.push(middle[Math.floor(i * step)])
  }

  return [...first, ...sampled, ...last]
}

export function formatConversationForSummary(messages: ChatMessage[]): string {
  const pairs = buildPairs(messages)
  const sampled = samplePairs(pairs)

  let output = ''
  for (const pair of sampled) {
    const userText = pair.user.length > MAX_USER ? pair.user.slice(0, MAX_USER) + '...' : pair.user

    let block = `> User: ${userText}\n`

    if (pair.assistant) {
      const assistantText = truncateAssistant(pair.assistant, MAX_ASSISTANT)
      block += `  Assistant: ${assistantText}\n`
    }

    block += '\n'

    if (output.length + block.length > MAX_TOTAL) break
    output += block
  }

  return output
}
