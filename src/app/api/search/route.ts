import { NextRequest, NextResponse } from 'next/server'
import { search, syncIndex, getIndexStats } from '@/lib/search-db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const project = searchParams.get('project') || undefined

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 })
  }

  try {
    const syncResult = syncIndex()
    const results = search(query, limit, project)
    const stats = getIndexStats()

    return NextResponse.json({
      results,
      sync: syncResult,
      stats,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
