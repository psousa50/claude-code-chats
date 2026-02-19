import { ChatMessage, ContentBlock } from './types'

export function extractTextFromContent(content: ChatMessage['message']['content']): string {
  if (typeof content === 'string') {
    return content
  }
  const textBlock = content.find(
    (block): block is ContentBlock & { type: 'text' } => block.type === 'text',
  )
  if (textBlock) {
    return textBlock.text
  }
  return ''
}

export function isSystemMessage(message: ChatMessage): boolean {
  if (message.isMeta) return true

  const text = extractTextFromContent(message.message.content)
  if (text.startsWith('<command-name>')) return true
  if (text.startsWith('<local-command-')) return true
  if (text.startsWith('Caveat:')) return true

  return false
}

export function hasNoVisibleContent(message: ChatMessage): boolean {
  const content = message.message.content

  if (typeof content === 'string') {
    return content.trim().length === 0
  }

  if (content.length === 0) return true

  const hasVisibleText = content.some(
    (block) => block.type === 'text' && block.text.trim().length > 0,
  )

  return !hasVisibleText
}
