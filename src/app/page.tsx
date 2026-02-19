import { ProjectList } from "@/components/project-list";
import { GlobalSearch } from "@/components/global-search";
import { SyncButton } from "@/components/sync-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-edge-subtle bg-surface/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="p-2 bg-accent/10 rounded-lg">
                <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-medium text-content-primary tracking-tight">Claude Code Chats</h1>
                <p className="text-xs text-content-tertiary">Browse your chat history</p>
              </div>
            </div>
            <div className="flex-1 max-w-md">
              <GlobalSearch />
            </div>
            <ThemeToggle />
            <SyncButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <ProjectList />
      </main>
    </div>
  );
}
