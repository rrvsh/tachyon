import { getOne, snapshot, transactPut } from "./db";
import {
  now,
  type AgentRecord,
  type ExportFile,
  type MessageRecord,
  type QuarantineRecord,
  type SessionRecord,
} from "./schema";
import {
  recordsEqual,
  validateAgent,
  validateExportFile,
  validateMessage,
  validateSession,
} from "./validation";

export async function createExport(): Promise<ExportFile> {
  const snap = await snapshot();
  return {
    version: 1,
    exportedAt: now(),
    sessions: snap.sessions,
    messages: snap.messages,
    agents: snap.agents,
  };
}

function quarantine(
  kind: QuarantineRecord["kind"],
  record: unknown,
  reason: string,
): QuarantineRecord {
  const id = `q_${kind}_${String((record as { id?: unknown })?.id ?? crypto.randomUUID())}_${now()}`;
  return { id, kind, record, reason, createdAt: now() };
}

function withoutKeys<T extends Record<string, unknown>>(
  record: T,
  keys: string[],
): Record<string, unknown> {
  const copy = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
}

function mergeNonConflicting<T extends { updatedAt: number }>(
  store: "sessions" | "messages" | "agents",
  existing: T,
  incoming: T,
): T | null {
  if (
    recordsEqual(
      withoutKeys(existing, ["updatedAt"]),
      withoutKeys(incoming, ["updatedAt"]),
    )
  ) {
    return incoming.updatedAt > existing.updatedAt ? incoming : existing;
  }
  if (
    (store === "sessions" || store === "agents") &&
    recordsEqual(
      withoutKeys(existing, ["updatedAt", "archived"]),
      withoutKeys(incoming, ["updatedAt", "archived"]),
    )
  ) {
    return incoming.updatedAt > existing.updatedAt ? incoming : existing;
  }
  return null;
}

async function mergeOne<T extends { id: string; updatedAt: number }>(
  store: "sessions" | "messages" | "agents",
  incoming: T,
  validate: (v: unknown) => boolean,
  referenceError?: string | null,
): Promise<{ record?: T; quarantine?: QuarantineRecord }> {
  const kind = store.slice(0, -1) as QuarantineRecord["kind"];
  if (!validate(incoming))
    return {
      quarantine: quarantine(kind, incoming, "Validation failed"),
    };
  if (referenceError)
    return {
      quarantine: quarantine(kind, incoming, referenceError),
    };
  const existing = await getOne<T>(store, incoming.id);
  if (!existing) return { record: incoming };
  if (recordsEqual(existing, incoming)) return {};
  const merged = mergeNonConflicting(store, existing, incoming);
  if (merged) return recordsEqual(existing, merged) ? {} : { record: merged };
  return {
    quarantine: quarantine(kind, incoming, "Conflicting stable ID record"),
  };
}

async function existingMaps(): Promise<{
  sessions: Map<string, SessionRecord>;
  messages: Map<string, MessageRecord>;
}> {
  const snap = await snapshot();
  return {
    sessions: new Map(snap.sessions.map((s) => [s.id, s])),
    messages: new Map(snap.messages.map((m) => [m.id, m])),
  };
}

function referenceErrors(
  file: ExportFile,
  existing: {
    sessions: Map<string, SessionRecord>;
    messages: Map<string, MessageRecord>;
  },
): { sessions: Map<string, string>; messages: Map<string, string> } {
  const sessionErrors = new Map<string, string>();
  const messageErrors = new Map<string, string>();
  const sessions = new Map(existing.sessions);
  const messages = new Map(existing.messages);
  for (const session of file.sessions) sessions.set(session.id, session);
  for (const message of file.messages) messages.set(message.id, message);

  for (const session of file.sessions) {
    if (!session.rootMessageId) continue;
    const root = messages.get(session.rootMessageId);
    if (!root || root.sessionId !== session.id || root.parentId !== null)
      sessionErrors.set(
        session.id,
        "Session rootMessageId does not reference a root message in the same session",
      );
  }

  for (const message of file.messages) {
    if (!sessions.has(message.sessionId)) {
      messageErrors.set(message.id, "Message references a missing session");
      continue;
    }
    if (!message.parentId) continue;
    const parent = messages.get(message.parentId);
    if (!parent || parent.sessionId !== message.sessionId) {
      messageErrors.set(
        message.id,
        "Message parent does not belong to the same session",
      );
      continue;
    }
    if (parent.createdAt > message.createdAt)
      messageErrors.set(message.id, "Message parent is newer than child");
  }
  return { sessions: sessionErrors, messages: messageErrors };
}

export async function importFile(
  value: unknown,
): Promise<{ imported: number; quarantined: number }> {
  if (!validateExportFile(value)) throw new Error("Invalid export file.");
  const refs = referenceErrors(value, await existingMaps());
  const sessions: SessionRecord[] = [];
  const messages: MessageRecord[] = [];
  const agents: AgentRecord[] = [];
  const quarantined: QuarantineRecord[] = [];
  for (const s of value.sessions) {
    const r = await mergeOne(
      "sessions",
      s,
      validateSession,
      refs.sessions.get(s.id),
    );
    if (r.record) sessions.push(r.record);
    if (r.quarantine) quarantined.push(r.quarantine);
  }
  for (const m of value.messages) {
    const r = await mergeOne(
      "messages",
      m,
      validateMessage,
      refs.messages.get(m.id),
    );
    if (r.record) messages.push(r.record);
    if (r.quarantine) quarantined.push(r.quarantine);
  }
  for (const a of value.agents) {
    const r = await mergeOne("agents", a, validateAgent);
    if (r.record) agents.push(r.record);
    if (r.quarantine) quarantined.push(r.quarantine);
  }
  await transactPut({ sessions, messages, agents, quarantine: quarantined });
  return {
    imported: sessions.length + messages.length + agents.length,
    quarantined: quarantined.length,
  };
}
