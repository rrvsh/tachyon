import { assertValidAgentConfig } from "../agents/agents";
import type { AgentRecord } from "../data/schema";
import type { TransportDelta, TransportTurn } from "./transport";

export function buildChatCompletionsPayload(
  agent: AgentRecord,
  turns: TransportTurn[],
): Record<string, unknown> {
  assertValidAgentConfig(agent);
  return {
    ...agent.params,
    model: agent.model,
    messages: agent.systemPrompt.trim()
      ? [{ role: "system", content: agent.systemPrompt }, ...turns]
      : turns,
    stream: true,
  };
}

export async function streamChatCompletions(
  input: {
    url: string;
    apiKey?: string;
    headers?: Record<string, string>;
    payload: Record<string, unknown>;
    signal: AbortSignal;
    errorLabel: string;
  },
  onDelta: (delta: TransportDelta) => Promise<void> | void,
): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    throw new Error("Network is offline. Reconnect before sending.");

  let response: Response;
  try {
    response = await fetch(input.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
        ...input.headers,
      },
      body: JSON.stringify(input.payload),
      signal: input.signal,
    });
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        `The browser blocked ${input.errorLabel}. Check its CORS and HTTPS configuration.`,
      );
    throw error;
  }

  if (!response.ok || !response.body)
    throw new Error(
      `${input.errorLabel} error ${response.status}: ${await response.text()}`,
    );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      const json = JSON.parse(data) as {
        choices?: {
          delta?: {
            content?: string;
            reasoning?: string;
            reasoning_content?: string;
            thinking?: string;
            reasoning_details?: unknown[];
          };
        }[];
      };
      const delta = json.choices?.[0]?.delta;
      if (!delta) continue;
      if (
        delta.content ||
        delta.reasoning ||
        delta.reasoning_content ||
        delta.thinking ||
        delta.reasoning_details
      )
        await onDelta({
          content: delta.content,
          reasoning:
            delta.reasoning ?? delta.reasoning_content ?? delta.thinking,
          reasoningDetails: delta.reasoning_details,
        });
    }
  }
}
