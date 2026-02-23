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

export function extractAllTextFromContent(content: ChatMessage['message']['content']): string {
  if (typeof content === 'string') {
    return content
  }
  return content
    .filter((block): block is ContentBlock & { type: 'text' } => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

export function parseCommandInvocation(text: string): { name: string; args: string } | null {
  if (!text.startsWith('<command-name>') && !text.startsWith('<command-message>')) return null

  const nameMatch = text.match(/<command-name>([^<]+)<\/command-name>/)
  if (!nameMatch) return null

  const argsMatch = text.match(/<command-args>([^<]*)<\/command-args>/)

  return {
    name: nameMatch[1].trim(),
    args: argsMatch ? argsMatch[1].trim() : '',
  }
}

export function isSystemMessage(message: ChatMessage): boolean {
  if (message.isMeta) return true

  const text = extractTextFromContent(message.message.content)
  if (text.startsWith('<local-command-')) return true
  if (text.startsWith('Caveat:')) return true
  if (text.startsWith('<system-reminder>')) return true

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
