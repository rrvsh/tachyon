import type {
  AgentRecord,
  ExportFile,
  MessageRecord,
  SessionRecord,
} from "./schema";

export const requestOwnedParamKeys = new Set(["model", "messages", "stream"]);
const allowedRoles = new Set(["user", "assistant"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(o: Record<string, unknown>, key: string): boolean {
  return typeof o[key] === "string";
}

function hasNumber(o: Record<string, unknown>, key: string): boolean {
  return typeof o[key] === "number" && Number.isFinite(o[key] as number);
}

export function validateSession(value: unknown): value is SessionRecord {
  if (!isObject(value)) return false;
  return (
    hasString(value, "id") &&
    String(value.id).length === 8 &&
    hasString(value, "title") &&
    hasNumber(value, "createdAt") &&
    hasNumber(value, "updatedAt") &&
    typeof value.archived === "boolean" &&
    (typeof value.rootMessageId === "string" || value.rootMessageId === null)
  );
}

export function validateMessage(value: unknown): value is MessageRecord {
  if (!isObject(value)) return false;
  if (
    !hasString(value, "id") ||
    !hasString(value, "sessionId") ||
    !allowedRoles.has(String(value.role))
  )
    return false;
  if (
    !hasString(value, "content") ||
    !(typeof value.parentId === "string" || value.parentId === null)
  )
    return false;
  if (
    !hasNumber(value, "createdAt") ||
    !hasNumber(value, "updatedAt") ||
    typeof value.finalized !== "boolean"
  )
    return false;
  if (
    "deletedAt" in value &&
    value.deletedAt !== undefined &&
    !hasNumber(value, "deletedAt")
  )
    return false;
  if (
    "reasoning" in value &&
    value.reasoning !== undefined &&
    typeof value.reasoning !== "string"
  )
    return false;
  if (
    "reasoningDetails" in value &&
    value.reasoningDetails !== undefined &&
    !Array.isArray(value.reasoningDetails)
  )
    return false;
  return value.role === "assistant" || value.finalized === true;
}

export function validateAgent(value: unknown): value is AgentRecord {
  if (!isObject(value)) return false;
  return (
    hasString(value, "id") &&
    hasString(value, "name") &&
    hasString(value, "model") &&
    hasString(value, "systemPrompt") &&
    isObject(value.params) &&
    hasNumber(value, "createdAt") &&
    hasNumber(value, "updatedAt") &&
    typeof value.archived === "boolean"
  );
}

export function validateAgentConfig(agent: AgentRecord): string[] {
  const errors: string[] = [];
  if (!agent.name.trim()) errors.push("Agent name is required.");
  if (!agent.model.trim()) errors.push("Agent model is required.");
  for (const key of Object.keys(agent.params ?? {})) {
    if (requestOwnedParamKeys.has(key))
      errors.push(`Agent params must not contain request-owned field: ${key}.`);
  }
  return errors;
}

export function validateExportFile(value: unknown): value is ExportFile {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !hasNumber(value, "exportedAt")
  )
    return false;
  return (
    Array.isArray(value.sessions) &&
    Array.isArray(value.messages) &&
    Array.isArray(value.agents) &&
    value.sessions.every(validateSession) &&
    value.messages.every(validateMessage) &&
    value.agents.every(validateAgent)
  );
}

export function recordsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
