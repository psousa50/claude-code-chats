import { NextRequest, NextResponse } from 'next/server'
import { getSummary, saveSummary, getSessionSummaries } from '@/lib/search-db'
import { getSessionById, getSubagentById, getProjectByPath } from '@/lib/chat-reader'
import { generateSessionSummary, generateProjectSummary } from '@/lib/claude-cli'
import { formatConversationForSummary } from '@/lib/summary-format'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') as 'session' | 'project' | null
  const projectPath = searchParams.get('project')
  const sessionId = searchParams.get('session')
  const agentId = searchParams.get('agent')

  if (!type || !projectPath) {
    return NextResponse.json(
      { error: 'Missing required parameters: type and project' },
      { status: 400 },
    )
  }

  if (type === 'session' && !sessionId && !agentId) {
    return NextResponse.json({ error: 'Missing required parameter: session' }, { status: 400 })
  }

  try {
    const targetId = agentId ? `subagent:${agentId}` : type === 'session' ? sessionId! : projectPath
    const summary = getSummary(type, targetId, projectPath)

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Get summary error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { type, projectPath, sessionId, agentId } = body as {
    type: 'session' | 'project'
    projectPath: string
    sessionId?: string
    agentId?: string
  }

  if (!type || !projectPath) {
    return NextResponse.json(
      { error: 'Missing required parameters: type and projectPath' },
      { status: 400 },
    )
  }

  if (type === 'session' && !sessionId && !agentId) {
    return NextResponse.json({ error: 'Missing required parameter: sessionId' }, { status: 400 })
  }

  try {
    if (type === 'session') {
      const session = agentId
        ? getSubagentById(projectPath, sessionId!, agentId)
        : getSessionById(projectPath, sessionId!)

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      const conversationText = formatConversationForSummary(session.messages, {
        includeSidechain: !!agentId,
      })
      const result = await generateSessionSummary(conversationText)

      if (!result.success) {
        return NextResponse.json(
          { error: 'Failed to generate summary', details: result.error },
          { status: 500 },
        )
      }

      const targetId = agentId ? `subagent:${agentId}` : sessionId!
      const summary = saveSummary({
        type: 'session',
        targetId,
        projectPath,
        content: result.output,
        createdAt: Date.now(),
        messageCount: session.messageCount,
      })

      return NextResponse.json({ summary })
    }

    const project = getProjectByPath(projectPath)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const sessionSummaries = getSessionSummaries(projectPath)
    if (sessionSummaries.length === 0) {
      return NextResponse.json(
        { error: 'No session summaries found. Generate session summaries first.' },
        { status: 400 },
      )
    }

    const summaryTexts = sessionSummaries.map((s) => s.content)
    const result = await generateProjectSummary(summaryTexts)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to generate project summary', details: result.error },
        { status: 500 },
      )
    }

    const summary = saveSummary({
      type: 'project',
      targetId: projectPath,
      projectPath,
      content: result.output,
      createdAt: Date.now(),
      messageCount: project.totalMessages,
    })

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Generate summary error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
