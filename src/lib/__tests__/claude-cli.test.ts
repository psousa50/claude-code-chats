import { describe, it, expect } from "vitest";
import { createClaudeCli, type QueryFn } from "../claude-cli";

function makeQueryFn(result: string): QueryFn {
  return (() => {
    async function* gen() {
      yield { result };
    }
    return gen();
  }) as unknown as QueryFn;
}

function makeEmptyQueryFn(): QueryFn {
  return (() => {
    async function* gen() {
      yield { type: "assistant", message: "no result here" };
    }
    return gen();
  }) as unknown as QueryFn;
}

function makeThrowingQueryFn(error: Error): QueryFn {
  return (() => {
    async function* gen() {
      throw error;
    }
    return gen();
  }) as unknown as QueryFn;
}

describe("generateSessionSummary", () => {
  it("returns success with result text", async () => {
    const cli = createClaudeCli({
      queryFn: makeQueryFn("Fixed a login bug in the auth module."),
      claudeExecutable: "/usr/bin/false",
    });

    const response = await cli.generateSessionSummary("- Fix the login bug\n- Add validation");
    expect(response.success).toBe(true);
    expect(response.output).toBe("Fixed a login bug in the auth module.");
  });

  it("trims whitespace from result", async () => {
    const cli = createClaudeCli({
      queryFn: makeQueryFn("  trimmed result  "),
      claudeExecutable: "/usr/bin/false",
    });

    const response = await cli.generateSessionSummary("test");
    expect(response.output).toBe("trimmed result");
  });

  it("returns error when no result is yielded", async () => {
    const cli = createClaudeCli({
      queryFn: makeEmptyQueryFn(),
      claudeExecutable: "/usr/bin/false",
    });

    const response = await cli.generateSessionSummary("test");
    expect(response.success).toBe(false);
    expect(response.error).toBe("No result returned");
  });

  it("returns error when query throws", async () => {
    const cli = createClaudeCli({
      queryFn: makeThrowingQueryFn(new Error("SDK connection failed")),
      claudeExecutable: "/usr/bin/false",
    });

    const response = await cli.generateSessionSummary("test");
    expect(response.success).toBe(false);
    expect(response.error).toContain("SDK connection failed");
  });
});

describe("generateProjectSummary", () => {
  it("returns success with summary text", async () => {
    const cli = createClaudeCli({
      queryFn: makeQueryFn("A web app for managing chat history."),
      claudeExecutable: "/usr/bin/false",
    });

    const response = await cli.generateProjectSummary([
      "Fixed auth bugs",
      "Added dark mode",
    ]);
    expect(response.success).toBe(true);
    expect(response.output).toBe("A web app for managing chat history.");
  });

  it("returns error when query throws", async () => {
    const cli = createClaudeCli({
      queryFn: makeThrowingQueryFn(new Error("timeout")),
      claudeExecutable: "/usr/bin/false",
    });

    const response = await cli.generateProjectSummary(["summary 1"]);
    expect(response.success).toBe(false);
    expect(response.error).toContain("timeout");
  });
});
