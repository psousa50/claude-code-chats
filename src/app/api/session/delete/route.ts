import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { removeFromArchive, DEFAULT_ARCHIVE_DIR } from '@/lib/archive'

export const dynamic = 'force-dynamic'

const CLAUDE_DIR = path.join(process.env.HOME || '', '.claude')
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

interface DeleteRequest {
  encodedPath: string
  sessionId: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeleteRequest
    const { encodedPath, sessionId } = body

    if (!encodedPath || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameters: encodedPath and sessionId' },
        { status: 400 },
      )
    }

    const liveProjectDir = path.join(PROJECTS_DIR, encodedPath)
    const liveSessionFile = path.join(liveProjectDir, `${sessionId}.jsonl`)
    const archiveSessionFile = path.join(DEFAULT_ARCHIVE_DIR, encodedPath, `${sessionId}.jsonl`)

    const liveExists = fs.existsSync(liveSessionFile)
    const archiveExists = fs.existsSync(archiveSessionFile)

    if (!liveExists && !archiveExists) {
      return NextResponse.json(
        { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
        { status: 404 },
      )
    }

    if (liveExists) {
      fs.unlinkSync(liveSessionFile)
      const liveSubagentDir = path.join(liveProjectDir, sessionId)
      if (fs.existsSync(liveSubagentDir)) {
        fs.rmSync(liveSubagentDir, { recursive: true, force: true })
      }
    }

    removeFromArchive(encodedPath, sessionId)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to delete session', details: message },
      { status: 500 },
    )
  }
}
