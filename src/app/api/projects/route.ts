import { NextResponse } from 'next/server'
import { getProjectsSummary } from '@/lib/chat-reader'

export const dynamic = 'force-dynamic'

export async function GET() {
  const projects = getProjectsSummary()
  return NextResponse.json(projects)
}
