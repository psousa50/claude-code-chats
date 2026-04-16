import { NextRequest, NextResponse } from 'next/server'
import { restoreFromArchive } from '@/lib/archive'

export const dynamic = 'force-dynamic'

interface RestoreRequest {
  encodedPath: string
  sessionId: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RestoreRequest
    const { encodedPath, sessionId } = body

    if (!encodedPath || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameters: encodedPath and sessionId' },
        { status: 400 },
      )
    }

    const outcome = restoreFromArchive(encodedPath, sessionId)

    if (outcome === 'not-archived') {
      return NextResponse.json(
        { error: 'Session not found in archive', code: 'NOT_ARCHIVED' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, outcome })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to restore session', details: message },
      { status: 500 },
    )
  }
}
