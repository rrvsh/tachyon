import type { ConnectionRecord } from "../data/schema";
import {
  buildChatCompletionsPayload,
  streamChatCompletions,
} from "./chatCompletions";
import type { Transport } from "./transport";

export function openAICompatibleTransport(
  connection: ConnectionRecord,
): Transport {
  return {
    async stream({ agent, turns, apiKey, signal }, onDelta) {
      await streamChatCompletions(
        {
          url: connection.endpointUrl,
          apiKey,
          payload: buildChatCompletionsPayload(agent, turns),
          signal,
          errorLabel: connection.name,
        },
        onDelta,
      );
    },
  };
}
