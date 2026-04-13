import { NextRequest, NextResponse } from 'next/server'
import { getSessionsSummary, getSessionById } from '@/lib/chat-reader'
import {
  isSystemMessage,
  hasNoVisibleContent,
  extractAllTextFromContent,
  parseCommandInvocation,
} from '@/lib/message-utils'
import { ChatMessage } from '@/lib/types'

function formatTimestamp(ts: string | number): string {
  const ms = typeof ts === 'number' ? ts : parseInt(ts)
  return new Date(ms).toISOString()
}

function formatDate(ts: number): string {
  return new Date(ts).toISOString().split('T')[0]
}

function extractText(message: ChatMessage): string {
  const content = message.message.content
  if (typeof content === 'string') return content.trim()
  return extractAllTextFromContent(content).trim()
}

function isVisible(message: ChatMessage): boolean {
  if (message.isSidechain) return false
  if (isSystemMessage(message)) return false
  if (hasNoVisibleContent(message)) return false
  const text = extractText(message)
  if (parseCommandInvocation(text)) return false
  return true
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const encodedPath = searchParams.get('path')

  if (!encodedPath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  const sessionSummaries = getSessionsSummary(encodedPath)

  if (sessionSummaries.length === 0) {
    return NextResponse.json({ error: 'No sessions found' }, { status: 404 })
  }

  const sorted = [...sessionSummaries].sort((a, b) => a.lastActivity - b.lastActivity)

  const parts: string[] = []
  parts.push(`# Project chats\n`)

  for (const summary of sorted) {
    const session = getSessionById(encodedPath, summary.id)
    if (!session) continue

    const visible = session.messages.filter(isVisible)
    if (visible.length === 0) continue

    const date = formatDate(summary.lastActivity)
    const firstUser = visible.find((m) => {
      if (m.message.role !== 'user') return false
      const text = extractText(m)
      return text && !parseCommandInvocation(text)
    })
    const heading = firstUser ? extractText(firstUser).slice(0, 100) : 'Untitled'
    parts.push(`\n## Session: ${date} — "${heading}"\n`)

    for (const msg of visible) {
      const text = extractText(msg)
      if (!text) continue

      const role = msg.message.role === 'user' ? 'User' : 'Assistant'
      const ts = formatTimestamp(msg.timestamp)
      parts.push(`### ${role}\n*${ts}*\n\n${text}\n`)
    }

    parts.push(`---\n`)
  }

  const markdown = parts.join('\n')
  const filename = `project-${encodedPath}.md`

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
