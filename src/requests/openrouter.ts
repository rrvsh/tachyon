import type { Transport } from "./transport";
import {
  buildChatCompletionsPayload,
  streamChatCompletions,
} from "./chatCompletions";

export const openRouterTransport: Transport = {
  async stream({ agent, turns, apiKey, signal }, onDelta) {
    await streamChatCompletions(
      {
        url: "https://openrouter.ai/api/v1/chat/completions",
        apiKey,
        headers: {
          "HTTP-Referer": location.origin,
          "X-Title": "Tachyon",
        },
        payload: buildChatCompletionsPayload(agent, turns),
        signal,
        errorLabel: "OpenRouter",
      },
      onDelta,
    );
  },
};
