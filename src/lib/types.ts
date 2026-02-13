export type MessageRole = "user" | "assistant";

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

export interface ChatMessage {
  parentUuid: string | null;
  isSidechain: boolean;
  isMeta?: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  type: "user" | "assistant" | "file-history-snapshot";
  message: {
    role: MessageRole;
    content: ContentBlock[] | string;
    usage?: TokenUsage;
  };
  uuid: string;
  timestamp: string | number;
}

export interface ChatSession {
  id: string;
  projectPath: string;
  projectName: string;
  encodedPath: string;
  messages: ChatMessage[];
  firstMessage: string;
  lastActivity: number;
  messageCount: number;
  tokenUsage?: TokenUsage;
}

export interface Project {
  path: string;
  name: string;
  encodedPath: string;
  sessions: ChatSession[];
  totalMessages: number;
  lastActivity: number;
}

export interface ProjectSummary {
  path: string;
  name: string;
  encodedPath: string;
  sessionCount: number;
  totalMessages: number;
  lastActivity: number;
  hasMemory: boolean;
}

export interface SessionSummary {
  id: string;
  encodedPath: string;
  firstMessage: string;
  messageCount: number;
  lastActivity: number;
}

export interface AISummary {
  id: string;
  type: "session" | "project";
  targetId: string;
  projectPath: string;
  content: string;
  createdAt: number;
  messageCount: number;
}
