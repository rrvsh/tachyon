import { agentId, now, type AgentRecord } from "../data/schema";
import { validateAgentConfig } from "../data/validation";

export function defaultAgent(): AgentRecord {
  const ts = now();
  return {
    id: agentId(),
    name: "Default",
    model: "openai/gpt-4o-mini",
    systemPrompt: "",
    params: { temperature: 0.7 },
    createdAt: ts,
    updatedAt: ts,
    archived: false,
  };
}

export function makeAgent(
  input: Partial<AgentRecord> & Pick<AgentRecord, "name" | "model">,
): AgentRecord {
  const ts = now();
  return {
    id: input.id ?? agentId(),
    name: input.name,
    model: input.model,
    systemPrompt: input.systemPrompt ?? "",
    params: input.params ?? {},
    createdAt: input.createdAt ?? ts,
    updatedAt: ts,
    archived: input.archived ?? false,
  };
}

export function assertValidAgentConfig(agent: AgentRecord): void {
  const errors = validateAgentConfig(agent);
  if (errors.length) throw new Error(errors.join("\n"));
}
