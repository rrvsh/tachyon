import type { AgentRecord } from "../data/schema";

export type AgentProvider = "openrouter" | "openai-compatible";

export function resolveAgentProvider(agent: AgentRecord): AgentProvider {
  return agent.connectionId ? "openai-compatible" : "openrouter";
}
