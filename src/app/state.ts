import { getAll, getMessagesBySession, getOne } from "../data/db";
import type { AgentRecord, MessageRecord, SessionRecord } from "../data/schema";
import { latestLeaf, visiblePath } from "../messages/tree";
import { getCurrentPointer } from "../settings/settings";

export interface AppState {
  sessionId: string | null;
  session: SessionRecord | null;
  sessions: SessionRecord[];
  archivedSessions: SessionRecord[];
  messages: MessageRecord[];
  visible: MessageRecord[];
  agents: AgentRecord[];
  currentMessageId: string | null;
  errors: string[];
  info: string[];
}

const errors: string[] = [];
const info: string[] = [];

export function notify(message: string, kind: "error" | "info" = "info"): void {
  (kind === "error" ? errors : info).push(message);
  window.dispatchEvent(new CustomEvent("app:changed"));
}

export function clearNotice(index: number, kind: "error" | "info"): void {
  (kind === "error" ? errors : info).splice(index, 1);
}

export function sessionIdFromUrl(): string | null {
  return new URLSearchParams(location.search).get("session");
}

export async function loadState(): Promise<AppState> {
  const [allSessions, agents] = await Promise.all([
    getAll<SessionRecord>("sessions"),
    getAll<AgentRecord>("agents"),
  ]);
  const sessionId = sessionIdFromUrl();
  const session = sessionId
    ? ((await getOne<SessionRecord>("sessions", sessionId)) ?? null)
    : null;
  const messages = session ? await getMessagesBySession(session.id) : [];
  const storedPointer = session ? getCurrentPointer(session.id) : null;
  const current =
    storedPointer && messages.some((m) => m.id === storedPointer)
      ? storedPointer
      : session
        ? (latestLeaf(messages, session.id)?.id ?? null)
        : null;
  return {
    sessionId: session?.id ?? null,
    session,
    sessions: allSessions
      .filter((s) => !s.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt),
    archivedSessions: allSessions
      .filter((s) => s.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt),
    messages,
    visible: session ? visiblePath(messages, current, session.id) : [],
    agents: agents.sort((a, b) => a.name.localeCompare(b.name)),
    currentMessageId: current,
    errors: [...errors],
    info: [...info],
  };
}
