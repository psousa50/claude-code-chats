# Architecture

Next.js web app for browsing, searching, and summarising Claude Code chat history stored locally.

## Tech Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · better-sqlite3 (FTS5) · react-markdown

## Directory Structure

```
bin/
  cc-chats.mjs              CLI entry point — spawns Next.js server on configurable port
src/
  app/
    layout.tsx               Root layout — fonts, theme/font-size providers, auto-sync
    page.tsx                 Home — project grid with search/sort/filter
    globals.css              Design tokens (light/dark), animations, scrollbar styles
    search/
      page.tsx               Search page — global full-text search with optional project scope
      search-results.tsx     Client component rendering search hits with highlighted snippets
    project/[projectPath]/
      page.tsx               Project detail — session list, summary, memory viewer
      session/[sessionId]/
        page.tsx             Session detail — chat thread, stats, actions (export/duplicate/delete)
        subagent/[agentId]/
          page.tsx           Subagent conversation view
    api/
      projects/              GET /projects (summaries), GET /projects/sessions, GET /projects/memory
      search/                GET /search — FTS query with sync-on-read
      sync/                  POST /sync — manual index rebuild
      summary/               GET/POST /summary — cached AI-generated summaries via Claude CLI
      session/               POST /session/delete, POST /session/duplicate, GET /session/export
      project/               POST /project/rename — renames both filesystem and index entries
  components/
    project-list.tsx         Fetches and renders project grid with filtering, sorting, pagination
    project-card.tsx         Project card — name, stats, memory badge
    project-header.tsx       Project page header — back nav, rename, memory, search, toggles
    project-page-content.tsx Project detail — sessions fetch, summary, session list
    session-list.tsx         Paginated session grid with search and short-session toggle
    session-card.tsx         Session card — first message preview, stats
    session-content.tsx      Session page — stats bar, resume command, summary, chat, actions
    chat-view.tsx            Core chat renderer — message filtering, truncation, subagent badges
    message-bubble.tsx       User/assistant message with markdown rendering and expand/collapse
    command-invocation-bubble.tsx  CLI command invocations as styled bubbles
    system-message-bubble.tsx     Filtered-by-default system message pills
    subagent-list.tsx        Links to subagent detail pages
    summary-section.tsx      AI summary display with generate/regenerate
    memory-viewer.tsx        Modal displaying project memory .md files
    rename-project-modal.tsx Modal for renaming project folders
    duplicate-session-button.tsx  Modal to clone sessions with message/tool filtering
    delete-session-button.tsx     Confirmation modal for session deletion
    export-button.tsx        Downloads session as markdown
    resume-command-copy.tsx  Copyable `claude --resume` command with permissions toggle
    global-search.tsx        Top-bar search with Cmd+K shortcut
    search-input.tsx         Reusable search input with clear button
    sync-button.tsx          Manual sync trigger with result counts
    auto-sync.tsx            Fire-and-forget sync on app mount
    theme-provider.tsx       Theme context (system/light/dark) with localStorage
    theme-toggle.tsx         Theme cycle button
    font-size-provider.tsx   Font size context (small/medium/large) with localStorage
    font-size-toggle.tsx     Font size cycle button
  lib/
    types.ts                 Core types — ChatMessage, ChatSession, Project, summaries, search results
    chat-reader.ts           Reads/parses JSONL chat files from ~/.claude/projects/
    search-db.ts             SQLite FTS5 index — sync, search, summary cache, project stats
    claude-cli.ts            Invokes Claude CLI for AI summary generation
    message-utils.ts         Content extraction, command parsing, system message detection
    summary-format.ts        Conversation sampling and formatting for summary prompts
    format.ts                Timestamp, token count, and path formatting utilities
    __tests__/               Unit tests for lib modules
    __fixtures__/            Sample JSONL files for testing
```

## Data Flow

```
~/.claude/projects/{encoded-path}/{sessionId}.jsonl
        │
        ├── chat-reader.ts ──── parse JSONL → filter user/assistant → build ChatSession objects
        │                        └── subagents: {sessionId}/subagents/agent-{agentId}.jsonl
        │
        └── search-db.ts ────── index messages in FTS5 table (synced by file mtime)
                                 └── ~/.claude/chat-search.db
        │
        ▼
    API routes ──── serve to React client
        │
        ▼
    Components ──── fetch, render, and interact
```

## Database Schema

**SQLite** at `~/.claude/chat-search.db` with three tables:

| Table                 | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `indexed_files`       | Tracks indexed JSONL files by path/mtime, stores session metadata    |
| `messages_fts` (FTS5) | Full-text searchable message content with session/project references |
| `summaries`           | Cached AI-generated summaries (session or project scope)             |

Schema versioned with incremental migrations (currently v1).

## API Surface

| Method | Route                                         | Purpose                               |
| ------ | --------------------------------------------- | ------------------------------------- |
| GET    | `/api/projects`                               | List all projects with summary stats  |
| GET    | `/api/projects/sessions?path=`                | Sessions for a project                |
| GET    | `/api/projects/memory?path=`                  | Memory .md files for a project        |
| GET    | `/api/search?q=&project=&limit=`              | Full-text search (syncs index first)  |
| POST   | `/api/sync`                                   | Manual index rebuild                  |
| GET    | `/api/summary?type=&project=&session=&agent=` | Fetch cached summary                  |
| POST   | `/api/summary`                                | Generate AI summary via Claude CLI    |
| POST   | `/api/session/delete`                         | Delete session JSONL file             |
| POST   | `/api/session/duplicate`                      | Clone session with optional filtering |
| GET    | `/api/session/export`                         | Download session as markdown          |
| POST   | `/api/project/rename`                         | Rename project folder + update index  |

## Configuration

| Variable        | Purpose                                                      | Default  |
| --------------- | ------------------------------------------------------------ | -------- |
| `HOME`          | Locates `~/.claude/projects/` and `~/.claude/chat-search.db` | System   |
| `CLAUDE_PATH`   | Path to Claude CLI binary for summary generation             | `claude` |
| `--port` / `-p` | Server port (CLI flag)                                       | `3000`   |

## Key Patterns

- **Path encoding**: Filesystem paths encoded as dash-separated strings for directory names; multiple decoding strategies (simple, recursive, glob) handle edge cases
- **Dependency injection**: `chat-reader` and `search-db` accept injectable deps for testability
- **Sync-on-read**: Search endpoint syncs the index before querying, keeping results fresh
- **Auto-sync**: App syncs index on mount; `sync-complete` custom event triggers refetches across components
- **Theme system**: CSS custom properties + early script injection prevent flash of unstyled content; three modes (system/light/dark)
- **Message classification**: System messages identified by meta flags, XML tags, and prefix patterns; filtered from counts and display by default
- **Summary pipeline**: Conversations sampled (first 2 + last 2 pairs, evenly distributed middle), truncated, sent to Claude CLI, cached in SQLite
- **Client caching**: Module-level Maps cache project/session data; stale after sync events
- **All API routes force-dynamic**: No static generation — data is always live from filesystem/database
