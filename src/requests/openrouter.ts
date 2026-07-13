import type { Transport } from "./transport";

export const openRouterTransport: Transport = {
  async stream({ payload, apiKey, signal }, onDelta) {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey ?? ""}`,
          "HTTP-Referer": location.origin,
          "X-Title": "Tachyon",
        },
        body: JSON.stringify(payload),
        signal,
      },
    );
    if (!response.ok || !response.body)
      throw new Error(
        `OpenRouter error ${response.status}: ${await response.text()}`,
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
        ) {
          await onDelta({
            content: delta.content,
            reasoning:
              delta.reasoning ?? delta.reasoning_content ?? delta.thinking,
            reasoningDetails: delta.reasoning_details,
          });
        }
      }
    }
  },
};
