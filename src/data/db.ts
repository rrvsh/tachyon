import {
  DB_NAME,
  DB_VERSION,
  type AgentRecord,
  type MessageRecord,
  type QuarantineRecord,
  type SessionRecord,
} from "./schema";

export interface DbSnapshot {
  sessions: SessionRecord[];
  messages: MessageRecord[];
  agents: AgentRecord[];
  quarantined: QuarantineRecord[];
}

type Store = "sessions" | "messages" | "agents" | "quarantine";
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
}

export async function deleteOne(name: Store, id: string): Promise<void> {
  const tx = await store("readwrite", name);
  await req(tx.objectStore(name).delete(id));
}

export async function getMessagesBySession(
  sessionId: string,
): Promise<MessageRecord[]> {
  const tx = await store("readonly", "messages");
  const index = tx.objectStore("messages").index("sessionId");
  return req<MessageRecord[]>(index.getAll(IDBKeyRange.only(sessionId)));
}

export async function transactPut(records: {
  sessions?: SessionRecord[];
  messages?: MessageRecord[];
  agents?: AgentRecord[];
  quarantine?: QuarantineRecord[];
}): Promise<void> {
  const names = Object.keys(records).filter(
    (k) => (records as Record<string, unknown[]>)[k]?.length,
  ) as Store[];
  if (!names.length) return;
  const tx = await store("readwrite", names);
  for (const session of records.sessions ?? [])
    tx.objectStore("sessions").put(session);
  for (const message of records.messages ?? [])
    tx.objectStore("messages").put(message);
  for (const agent of records.agents ?? []) tx.objectStore("agents").put(agent);
  for (const q of records.quarantine ?? []) tx.objectStore("quarantine").put(q);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function snapshot(): Promise<DbSnapshot> {
  const [sessions, messages, agents, quarantined] = await Promise.all([
    getAll<SessionRecord>("sessions"),
    getAll<MessageRecord>("messages"),
    getAll<AgentRecord>("agents"),
    getAll<QuarantineRecord>("quarantine"),
  ]);
  return { sessions, messages, agents, quarantined };
}

export async function clearDbForTests(): Promise<void> {
  const tx = await store("readwrite", [
    "sessions",
    "messages",
    "agents",
    "quarantine",
  ]);
  for (const name of [
    "sessions",
    "messages",
    "agents",
    "quarantine",
  ] as Store[])
    tx.objectStore(name).clear();
  await new Promise<void>((resolve) => (tx.oncomplete = () => resolve()));
}
