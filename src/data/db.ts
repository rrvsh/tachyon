import { markGithubSyncDirty } from "../sync/state";
import {
  DB_NAME,
  DB_VERSION,
  type AgentRecord,
  type ConnectionRecord,
  type MessageRecord,
  type QuarantineRecord,
  type SessionRecord,
} from "./schema";

export interface DbSnapshot {
  sessions: SessionRecord[];
  messages: MessageRecord[];
  agents: AgentRecord[];
  connections: ConnectionRecord[];
  quarantined: QuarantineRecord[];
}

export type Store =
  "sessions" | "messages" | "agents" | "connections" | "quarantine";
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sessions"))
        db.createObjectStore("sessions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("messages")) {
        const store = db.createObjectStore("messages", { keyPath: "id" });
        store.createIndex("sessionId", "sessionId");
      }
      if (!db.objectStoreNames.contains("agents"))
        db.createObjectStore("agents", { keyPath: "id" });
      if (!db.objectStoreNames.contains("connections"))
        db.createObjectStore("connections", { keyPath: "id" });
      if (!db.objectStoreNames.contains("quarantine"))
        db.createObjectStore("quarantine", { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  return dbPromise;
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function store(
  mode: IDBTransactionMode,
  names: Store | Store[],
): Promise<IDBTransaction> {
  const db = await openDb();
  return db.transaction(names, mode);
}

export async function getAll<T>(name: Store): Promise<T[]> {
  const tx = await store("readonly", name);
  return req<T[]>(tx.objectStore(name).getAll());
}

export async function getOne<T>(
  name: Store,
  id: string,
): Promise<T | undefined> {
  const tx = await store("readonly", name);
  return req<T | undefined>(tx.objectStore(name).get(id));
}

export async function putOne<T>(name: Store, value: T): Promise<void> {
  const tx = await store("readwrite", name);
  await req(tx.objectStore(name).put(value));
  if (name !== "quarantine") markGithubSyncDirty();
}

export async function deleteOne(name: Store, id: string): Promise<void> {
  const tx = await store("readwrite", name);
  await req(tx.objectStore(name).delete(id));
  if (name !== "quarantine") markGithubSyncDirty();
}

export async function getMessagesBySession(
  sessionId: string,
): Promise<MessageRecord[]> {
  const tx = await store("readonly", "messages");
  const index = tx.objectStore("messages").index("sessionId");
  return req<MessageRecord[]>(index.getAll(IDBKeyRange.only(sessionId)));
}

export async function replaceData(records: {
  sessions: SessionRecord[];
  messages: MessageRecord[];
  agents: AgentRecord[];
  connections: ConnectionRecord[];
  quarantine?: QuarantineRecord[];
}): Promise<void> {
  const names: Store[] = [
    "sessions",
    "messages",
    "agents",
    "connections",
    "quarantine",
  ];
  const tx = await store("readwrite", names);
  for (const name of names) tx.objectStore(name).clear();
  for (const session of records.sessions)
    tx.objectStore("sessions").put(session);
  for (const message of records.messages)
    tx.objectStore("messages").put(message);
  for (const agent of records.agents) tx.objectStore("agents").put(agent);
  for (const connection of records.connections)
    tx.objectStore("connections").put(connection);
  for (const q of records.quarantine ?? []) tx.objectStore("quarantine").put(q);
  await transactionDone(tx);
  markGithubSyncDirty();
}

export async function transactPut(records: {
  sessions?: SessionRecord[];
  messages?: MessageRecord[];
  agents?: AgentRecord[];
  connections?: ConnectionRecord[];
  quarantine?: QuarantineRecord[];
}): Promise<void> {
  const names = Object.keys(records).filter(
    (key) => (records as Record<string, unknown[]>)[key]?.length,
  ) as Store[];
  if (!names.length) return;
  const tx = await store("readwrite", names);
  for (const session of records.sessions ?? [])
    tx.objectStore("sessions").put(session);
  for (const message of records.messages ?? [])
    tx.objectStore("messages").put(message);
  for (const agent of records.agents ?? []) tx.objectStore("agents").put(agent);
  for (const connection of records.connections ?? [])
    tx.objectStore("connections").put(connection);
  for (const q of records.quarantine ?? []) tx.objectStore("quarantine").put(q);
  await transactionDone(tx);
  if (
    records.sessions?.length ||
    records.messages?.length ||
    records.agents?.length ||
    records.connections?.length
  )
    markGithubSyncDirty();
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function snapshot(): Promise<DbSnapshot> {
  const [sessions, messages, agents, connections, quarantined] =
    await Promise.all([
      getAll<SessionRecord>("sessions"),
      getAll<MessageRecord>("messages"),
      getAll<AgentRecord>("agents"),
      getAll<ConnectionRecord>("connections"),
      getAll<QuarantineRecord>("quarantine"),
    ]);
  return { sessions, messages, agents, connections, quarantined };
}

export async function clearDbForTests(): Promise<void> {
  const names: Store[] = [
    "sessions",
    "messages",
    "agents",
    "connections",
    "quarantine",
  ];
  const tx = await store("readwrite", names);
  for (const name of names) tx.objectStore(name).clear();
  await transactionDone(tx);
}
