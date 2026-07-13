import { describe, expect, it } from "vitest";
import type { MessageRecord } from "../../src/data/schema";
import {
  extractInlineThinking,
  normalizeMessageForDisplay,
} from "../../src/messages/display";

const assistant = (input: Partial<MessageRecord>): MessageRecord => ({
  id: "m",
  sessionId: "s",
  role: "assistant",
  content: "answer",
  parentId: null,
  createdAt: 1,
  updatedAt: 1,
  finalized: true,
  ...input,
});

describe("message display normalization", () => {
  it("extracts inline thinking tags from visible content", () => {
    const result = extractInlineThinking(
      "before <think>hidden</think> after <reason>why</reason> done",
    );
    expect(result.thinking).toEqual(["hidden", "why"]);
    expect(result.visibleContent).toBe("before  after  done");
  });

  it("treats unclosed thinking as hidden only while streaming", () => {
    expect(extractInlineThinking("answer <think>still thinking", true)).toEqual(
      {
        thinking: ["still thinking"],
        visibleContent: "answer ",
      },
    );
    expect(
      extractInlineThinking("answer <think>still thinking", false),
    ).toEqual({
      thinking: [],
      visibleContent: "answer <think>still thinking",
    });
  });

  it("extracts suffixed think tags", () => {
    const result = extractInlineThinking(
      "<think:6124c78e>hidden</think:6124c78e>visible",
    );
    expect(result.thinking).toEqual(["hidden"]);
    expect(result.visibleContent).toBe("visible");
  });

  it("normalizes structured and inline reasoning into one thinking text", () => {
    const result = normalizeMessageForDisplay(
      assistant({
        content: "<think>inline</think>final",
        reasoning: "structured",
        reasoningDetails: [
          { type: "reasoning.summary", summary: "summary" },
          { type: "reasoning.text", text: "detail" },
          { type: "reasoning.encrypted", data: "secret" },
        ],
      }),
    );
    expect(result.visibleContent).toBe("final");
    expect(result.thinkingText).toBe(
      "structured\n\n---\n\nsummarydetail\n\n---\n\ninline",
    );
  });

  it("deduplicates identical structured reasoning", () => {
    const result = normalizeMessageForDisplay(
      assistant({
        content: "final",
        reasoning: "same thinking",
        reasoningDetails: [{ type: "reasoning.text", text: "same thinking" }],
      }),
    );
    expect(result.thinkingText).toBe("same thinking");
  });
});
