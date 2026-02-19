import Link from 'next/link'
import { GlobalSearch } from '@/components/global-search'
import { SyncButton } from '@/components/sync-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { SearchResults } from './search-results'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ q?: string; project?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, project } = await searchParams
  const query = q || ''

  const backHref = project ? `/project/${project}` : '/'

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge-subtle bg-surface/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={backHref}
              className="p-2 -ml-2 text-content-tertiary hover:text-content-primary hover:bg-surface-elevated rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <div className="flex-1">
              <GlobalSearch projectPath={project} />
            </div>
            <ThemeToggle />
            <SyncButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <SearchResults query={query} projectPath={project} />
      </main>
    </div>
  )
}
