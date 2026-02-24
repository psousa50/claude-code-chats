import { NextRequest, NextResponse } from 'next/server'
import { getSessionById, getSubagentById } from '@/lib/chat-reader'
import { isSystemMessage, hasNoVisibleContent } from '@/lib/message-utils'
import { ChatMessage, ContentBlock } from '@/lib/types'

function formatTimestamp(ts: string | number): string {
  const ms = typeof ts === 'number' ? ts : parseInt(ts)
  return new Date(ms).toISOString()
}

function contentBlocksToMarkdown(content: ContentBlock[]): string {
  const parts: string[] = []
  for (const block of content) {
    if (block.type === 'text' && block.text.trim()) {
      parts.push(block.text.trim())
    } else if (block.type === 'tool_use') {
      const input = JSON.stringify(block.input, null, 2)
      parts.push(`\`[Tool: ${block.name}]\`\n\`\`\`json\n${input}\n\`\`\``)
    } else if (block.type === 'tool_result') {
      const result =
        typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
      parts.push(`**Tool Result:**\n\`\`\`\n${result}\n\`\`\``)
    }
  }
  return parts.join('\n\n')
}

function messageToMarkdown(message: ChatMessage, filterSidechain: boolean): string | null {
  if (filterSidechain && message.isSidechain) return null
  if (isSystemMessage(message)) return null
  if (hasNoVisibleContent(message)) return null

  const role = message.message.role === 'user' ? 'User' : 'Assistant'
  const ts = formatTimestamp(message.timestamp)

  let body: string
  if (typeof message.message.content === 'string') {
    body = message.message.content.trim()
  } else {
    body = contentBlocksToMarkdown(message.message.content)
  }

  if (!body) return null

  return `## ${role}\n*${ts}*\n\n${body}`
}

function generateMarkdown(
  session: {
    id: string
    projectName: string
    projectPath: string
    lastActivity: number
    messages: ChatMessage[]
  },
  label?: string,
  isSubagent = false,
): string {
  const exportedAt = new Date().toISOString()
  const sessionDate = new Date(session.lastActivity).toISOString()

  const messageSections = session.messages
    .map((m) => messageToMarkdown(m, !isSubagent))
    .filter((s): s is string => s !== null)

  const header = [
    `# Claude Code Chat Export`,
    ``,
    `**Project:** ${session.projectName}`,
    label ? `**${label}**` : `**Session:** \`${session.id}\``,
    `**Last activity:** ${sessionDate}`,
    `**Exported:** ${exportedAt}`,
    ``,
    `---`,
    ``,
  ].join('\n')

  return header + messageSections.join('\n\n---\n\n')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const encodedPath = searchParams.get('encodedPath')
  const sessionId = searchParams.get('sessionId')
  const agentId = searchParams.get('agentId')

  if (!encodedPath || !sessionId) {
    return NextResponse.json({ error: 'Missing encodedPath or sessionId' }, { status: 400 })
  }

  let session: {
    id: string
    projectName: string
    projectPath: string
    lastActivity: number
    messages: ChatMessage[]
  } | null

  if (agentId) {
    session = getSubagentById(encodedPath, sessionId, agentId)
  } else {
    session = getSessionById(encodedPath, sessionId)
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const label = agentId ? `Subagent: \`${agentId}\`` : undefined
  const markdown = generateMarkdown(session, label, !!agentId)

  const filename = agentId ? `subagent-${agentId}.md` : `session-${sessionId}.md`

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
