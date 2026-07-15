import type { AgentRecord } from "../data/schema";

export type AgentProvider = "openrouter";

export function resolveAgentProvider(_agent: AgentRecord): AgentProvider {
  return "openrouter";
}
