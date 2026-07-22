import { getOne, replaceData, snapshot, transactPut } from "./db";
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
  resolution?: ImportConflictResolution,
): Promise<{ record?: T; quarantine?: QuarantineRecord }> {
  const kind = store.slice(0, -1) as QuarantineRecord["kind"];
  if (!validate(incoming))
    return {
      quarantine: quarantine(kind, incoming, "Validation failed"),
    };
  if (referenceError) {
    if (resolution === "local" || resolution === "skip") return {};
    return {
      quarantine: quarantine(kind, incoming, referenceError),
    };
  }
  const existing = await getOne<T>(store, incoming.id);
  if (!existing) return { record: incoming };
  if (recordsEqual(existing, incoming)) return {};
  const merged = mergeNonConflicting(store, existing, incoming);
  if (merged) return recordsEqual(existing, merged) ? {} : { record: merged };
  if (resolution === "incoming") return { record: incoming };
  if (resolution === "local" || resolution === "skip") return {};
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

export interface ImportDiffBucket {
  added: number;
  changed: number;
  unchanged: number;
  removedOnReplace: number;
  quarantined: number;
}

export type ImportRecordStatus =
  "add" | "update" | "unchanged" | "delete on replace" | "conflict";

export interface ImportFieldDiff {
  field: string;
  local: string;
  incoming: string;
  text: boolean;
}

export interface ImportRecordDiff {
  store: "sessions" | "messages" | "agents";
  id: string;
  status: ImportRecordStatus;
  label: string;
  updatedAt?: number;
  reason?: string;
  fields: ImportFieldDiff[];
}

export type ImportConflictResolution = "local" | "incoming" | "skip";
export type ImportConflictResolutions = Record<
  string,
  ImportConflictResolution
>;

export interface ImportAnalysis {
  valid: boolean;
  error?: string;
  exportedAt?: number;
  summary?: Record<"sessions" | "messages" | "agents", ImportDiffBucket>;
  quarantineReasons: string[];
  records?: Record<"sessions" | "messages" | "agents", ImportRecordDiff[]>;
  file?: ExportFile;
}

function emptyBucket(): ImportDiffBucket {
  return {
    added: 0,
    changed: 0,
    unchanged: 0,
    removedOnReplace: 0,
    quarantined: 0,
  };
}

function countDiff<T extends { id: string }>(
  incoming: T[],
  existing: Map<string, T>,
): ImportDiffBucket {
  const bucket = emptyBucket();
  const incomingIds = new Set(incoming.map((record) => record.id));
  for (const record of incoming) {
    const current = existing.get(record.id);
    if (!current) bucket.added += 1;
    else if (recordsEqual(current, record)) bucket.unchanged += 1;
    else bucket.changed += 1;
  }
  for (const id of existing.keys())
    if (!incomingIds.has(id)) bucket.removedOnReplace += 1;
  return bucket;
}

function stringifyValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null)
    return String(value);
  return JSON.stringify(value, null, 2);
}

function labelRecord(
  store: "sessions" | "messages" | "agents",
  record: SessionRecord | MessageRecord | AgentRecord,
): string {
  if (store === "sessions") return (record as SessionRecord).title || record.id;
  if (store === "agents") return (record as AgentRecord).name || record.id;
  const message = record as MessageRecord;
  const snippet = message.content.replace(/\s+/g, " ").trim().slice(0, 80);
  return `${message.role}: ${snippet || message.id}`;
}

function isTextField(store: string, field: string): boolean {
  return (
    (store === "messages" && (field === "content" || field === "reasoning")) ||
    (store === "agents" && field === "systemPrompt")
  );
}

function fieldDiffs(
  store: "sessions" | "messages" | "agents",
  local: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null,
): ImportFieldDiff[] {
  const keys = new Set([
    ...Object.keys(local ?? {}),
    ...Object.keys(incoming ?? {}),
  ]);
  return [...keys]
    .filter((field) => !recordsEqual(local?.[field], incoming?.[field]))
    .map((field) => ({
      field,
      local: stringifyValue(local?.[field]),
      incoming: stringifyValue(incoming?.[field]),
      text: isTextField(store, field),
    }));
}

function conflictKey(
  store: "sessions" | "messages" | "agents",
  id: string,
): string {
  return `${store}:${id}`;
}

function recordDiff<T extends { id: string; updatedAt?: number }>(
  store: "sessions" | "messages" | "agents",
  status: ImportRecordStatus,
  record: T,
  local: T | null,
  incoming: T | null,
  reason?: string,
): ImportRecordDiff {
  return {
    store,
    id: record.id,
    status,
    label: labelRecord(
      store,
      record as unknown as SessionRecord | MessageRecord | AgentRecord,
    ),
    updatedAt: record.updatedAt,
    reason,
    fields: fieldDiffs(
      store,
      local as Record<string, unknown> | null,
      incoming as Record<string, unknown> | null,
    ),
  };
}

function analyzeRecords<T extends { id: string; updatedAt: number }>(
  store: "sessions" | "messages" | "agents",
  incoming: T[],
  existing: Map<string, T>,
  referenceReasons = new Map<string, string>(),
): ImportRecordDiff[] {
  const rows: ImportRecordDiff[] = [];
  const incomingIds = new Set(incoming.map((record) => record.id));
  for (const record of incoming) {
    const current = existing.get(record.id) ?? null;
    const reason = referenceReasons.get(record.id);
    if (!current) {
      rows.push(
        recordDiff(
          store,
          reason ? "conflict" : "add",
          record,
          null,
          record,
          reason,
        ),
      );
      continue;
    }
    if (recordsEqual(current, record)) {
      rows.push(recordDiff(store, "unchanged", record, current, record));
      continue;
    }
    const merged = reason ? null : mergeNonConflicting(store, current, record);
    rows.push(
      recordDiff(
        store,
        merged ? "update" : "conflict",
        record,
        current,
        record,
        reason ?? (merged ? undefined : "Conflicting stable ID record"),
      ),
    );
  }
  for (const current of existing.values()) {
    if (!incomingIds.has(current.id))
      rows.push(recordDiff(store, "delete on replace", current, current, null));
  }
  return rows;
}

export async function analyzeImport(value: unknown): Promise<ImportAnalysis> {
  if (!validateExportFile(value))
    return {
      valid: false,
      error: "Invalid export file.",
      quarantineReasons: [],
    };
  const snap = await snapshot();
  const existing = {
    sessions: new Map(snap.sessions.map((s) => [s.id, s])),
    messages: new Map(snap.messages.map((m) => [m.id, m])),
    agents: new Map(snap.agents.map((a) => [a.id, a])),
  };
  const refs = referenceErrors(value, existing);
  const summary = {
    sessions: countDiff(value.sessions, existing.sessions),
    messages: countDiff(value.messages, existing.messages),
    agents: countDiff(value.agents, existing.agents),
  };
  const quarantineReasons: string[] = [];
  for (const s of value.sessions) {
    const reason = refs.sessions.get(s.id);
    const current = existing.sessions.get(s.id);
    if (reason) {
      summary.sessions.quarantined += 1;
      quarantineReasons.push(`session ${s.id}: ${reason}`);
    } else if (
      current &&
      !recordsEqual(current, s) &&
      !mergeNonConflicting("sessions", current, s)
    ) {
      summary.sessions.quarantined += 1;
      quarantineReasons.push(`session ${s.id}: Conflicting stable ID record`);
    }
  }
  for (const m of value.messages) {
    const reason = refs.messages.get(m.id);
    const current = existing.messages.get(m.id);
    if (reason) {
      summary.messages.quarantined += 1;
      quarantineReasons.push(`message ${m.id}: ${reason}`);
    } else if (
      current &&
      !recordsEqual(current, m) &&
      !mergeNonConflicting("messages", current, m)
    ) {
      summary.messages.quarantined += 1;
      quarantineReasons.push(`message ${m.id}: Conflicting stable ID record`);
    }
  }
  for (const a of value.agents) {
    const current = existing.agents.get(a.id);
    if (
      current &&
      !recordsEqual(current, a) &&
      !mergeNonConflicting("agents", current, a)
    ) {
      summary.agents.quarantined += 1;
      quarantineReasons.push(`agent ${a.id}: Conflicting stable ID record`);
    }
  }
  return {
    valid: true,
    exportedAt: value.exportedAt,
    summary,
    quarantineReasons,
    records: {
      sessions: analyzeRecords(
        "sessions",
        value.sessions,
        existing.sessions,
        refs.sessions,
      ),
      messages: analyzeRecords(
        "messages",
        value.messages,
        existing.messages,
        refs.messages,
      ),
      agents: analyzeRecords("agents", value.agents, existing.agents),
    },
    file: value,
  };
}

export async function replaceImport(
  value: unknown,
): Promise<{ imported: number }> {
  if (!validateExportFile(value)) throw new Error("Invalid export file.");
  await replaceData({
    sessions: value.sessions,
    messages: value.messages,
    agents: value.agents,
  });
  return {
    imported:
      value.sessions.length + value.messages.length + value.agents.length,
  };
}

export async function importFile(
  value: unknown,
  resolutions: ImportConflictResolutions = {},
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
      resolutions[conflictKey("sessions", s.id)],
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
      resolutions[conflictKey("messages", m.id)],
    );
    if (r.record) messages.push(r.record);
    if (r.quarantine) quarantined.push(r.quarantine);
  }
  for (const a of value.agents) {
    const r = await mergeOne(
      "agents",
      a,
      validateAgent,
      undefined,
      resolutions[conflictKey("agents", a.id)],
    );
    if (r.record) agents.push(r.record);
    if (r.quarantine) quarantined.push(r.quarantine);
  }
  await transactPut({ sessions, messages, agents, quarantine: quarantined });
  return {
    imported: sessions.length + messages.length + agents.length,
    quarantined: quarantined.length,
  };
}
