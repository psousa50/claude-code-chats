import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getSessionsSummary, decodeProjectPath } from '@/lib/chat-reader'

const PROJECTS_DIR = path.join(process.env.HOME || '', '.claude', 'projects')

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const encodedPath = request.nextUrl.searchParams.get('path')
  if (!encodedPath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  const sessions = getSessionsSummary(encodedPath)
  const decodedPath = decodeProjectPath(encodedPath)
  const parts = decodedPath.split('/').filter(Boolean)
  const projectName = parts[parts.length - 1] || decodedPath
  const hasMemory = fs.existsSync(path.join(PROJECTS_DIR, encodedPath, 'memory', 'MEMORY.md'))

  return NextResponse.json({ sessions, projectName, decodedPath, hasMemory })
}
