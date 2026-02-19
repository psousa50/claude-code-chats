import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const CLAUDE_DIR = path.join(process.env.HOME || '', '.claude')
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

export async function GET(request: NextRequest) {
  const encodedPath = request.nextUrl.searchParams.get('path')

  if (!encodedPath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  const memoryDir = path.join(PROJECTS_DIR, encodedPath, 'memory')

  if (!fs.existsSync(memoryDir)) {
    return NextResponse.json({ error: 'No memory' }, { status: 404 })
  }

  const files: { name: string; content: string }[] = []

  try {
    const entries = fs
      .readdirSync(memoryDir)
      .filter((f) => f.endsWith('.md'))
      .sort((a, b) => {
        if (a === 'MEMORY.md') return -1
        if (b === 'MEMORY.md') return 1
        return a.localeCompare(b)
      })

    for (const entry of entries) {
      const content = fs.readFileSync(path.join(memoryDir, entry), 'utf-8')
      files.push({ name: entry, content })
    }
  } catch {
    return NextResponse.json({ error: 'Failed to read memory' }, { status: 500 })
  }

  return NextResponse.json({ files })
}
