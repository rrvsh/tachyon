export type Role = "user" | "assistant";

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  rootMessageId: string | null;
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  finalized: boolean;
  deletedAt?: number;
  reasoning?: string;
  reasoningDetails?: unknown[];
}

export interface AgentRecord {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  params: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
}

export interface QuarantineRecord {
  id: string;
  kind: "session" | "message" | "agent";
  reason: string;
  record: unknown;
  createdAt: number;
}

export interface SettingsRecord {
  openRouterApiKey: string;
  selectedAgentId: string | null;
  fontFamily: string;
  openThinkingByDefault: boolean;
  rightSidebarCollapsed: boolean;
}

export interface ExportFile {
  version: 1;
  exportedAt: number;
  sessions: SessionRecord[];
  messages: MessageRecord[];
  agents: AgentRecord[];
}

export const DB_NAME = "tachyon-chat";
export const DB_VERSION = 1;

export function now(): number {
  return Date.now();
}

export function shortId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36))
    .join("")
    .slice(0, 8);
}

export function messageId(): string {
  return `m_${shortId()}_${Date.now().toString(36)}`;
}

export function agentId(): string {
  return `a_${shortId()}`;
}
