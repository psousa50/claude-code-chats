import { query } from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeResponse {
  success: boolean;
  output: string;
  error?: string;
}

async function invokeClaude(prompt: string): Promise<ClaudeResponse> {
  try {
    let result = "";

    for await (const message of query({
      prompt,
      options: {
        allowedTools: [],
        maxTurns: 1,
      },
    })) {
      if ("result" in message) {
        result = message.result as string;
      }
    }

    if (!result) {
      return { success: false, output: "", error: "No result returned" };
    }

    return { success: true, output: result.trim() };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function generateSessionSummary(conversationText: string): Promise<ClaudeResponse> {
  const prompt = `Summarise this Claude Code session in 2-3 sentences. Focus on what was being built or fixed. Be specific and concise.

User requests from this session:
${conversationText}`;

  return invokeClaude(prompt);
}

export async function generateProjectSummary(sessionSummaries: string[]): Promise<ClaudeResponse> {
  const summariesText = sessionSummaries.map((s, i) => `Session ${i + 1}: ${s}`).join("\n");

  const prompt = `Given these session summaries from a coding project, provide a brief 2-3 sentence overview of what this project involves and recent activity.

${summariesText}`;

  return invokeClaude(prompt);
}
