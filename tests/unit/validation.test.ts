import { describe, expect, it } from "vitest";
import { defaultAgent } from "../../src/agents/agents";
import {
  validateAgentConfig,
  validateMessage,
} from "../../src/data/validation";

describe("validation", () => {
  it("rejects unfinalized user messages", () =>
    expect(
      validateMessage({
        id: "m",
        sessionId: "s",
        role: "user",
        content: "",
        parentId: null,
        createdAt: 1,
        updatedAt: 1,
        finalized: false,
      }),
    ).toBe(false));
  it("rejects request-owned agent params", () => {
    const agent = {
      ...defaultAgent(),
      params: { stream: false, temperature: 1 },
    };
    expect(validateAgentConfig(agent)).toContain(
      "Agent params must not contain request-owned field: stream.",
    );
  });
});
