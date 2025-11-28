import { spawn } from "child_process";

export interface ClaudeResponse {
  success: boolean;
  output: string;
  error?: string;
}

export async function invokeClaude(prompt: string, stdin?: string): Promise<ClaudeResponse> {
  return new Promise((resolve) => {
    const args = ["-p", prompt, "--output-format", "text"];

    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      resolve({
        success: false,
        output: "",
        error: `Failed to spawn claude: ${error.message}`,
      });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout.trim() });
      } else {
        resolve({
          success: false,
          output: stdout.trim(),
          error: stderr || `Process exited with code ${code}`,
        });
      }
    });

    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
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
