import type { MessageRecord } from "../data/schema";

export function compareByCreatedThenId<
  T extends { createdAt: number; id: string },
>(a: T, b: T): number {
  return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}

export function messagesForSession(
  messages: MessageRecord[],
  sessionId: string,
): MessageRecord[] {
  return messages
    .filter((m) => m.sessionId === sessionId)
    .sort(compareByCreatedThenId);
}

export function siblings(
  messages: MessageRecord[],
  message: MessageRecord,
): MessageRecord[] {
  return messages
    .filter(
      (m) =>
        m.sessionId === message.sessionId && m.parentId === message.parentId,
    )
    .sort(compareByCreatedThenId);
}

export function children(
  messages: MessageRecord[],
  parentId: string | null,
  sessionId?: string,
): MessageRecord[] {
  return messages
    .filter(
      (m) =>
        m.parentId === parentId && (!sessionId || m.sessionId === sessionId),
    )
    .sort(compareByCreatedThenId);
}

export function leafMessages(
  messages: MessageRecord[],
  sessionId: string,
): MessageRecord[] {
  const sessionMessages = messagesForSession(messages, sessionId);
  const parents = new Set(
    sessionMessages.map((m) => m.parentId).filter(Boolean),
  );
  return sessionMessages
    .filter((m) => !parents.has(m.id))
    .sort(compareByCreatedThenId);
}

export function latestLeaf(
  messages: MessageRecord[],
  sessionId: string,
): MessageRecord | null {
  return leafMessages(messages, sessionId).at(-1) ?? null;
}

export function latestDescendant(
  messages: MessageRecord[],
  start: MessageRecord,
): MessageRecord {
  const descendants = collectDescendants(messages, start.id, start.sessionId);
  const leaves = [start, ...descendants]
    .filter((m) => children(messages, m.id, start.sessionId).length === 0)
    .sort(compareByCreatedThenId);
  return leaves.at(-1) ?? start;
}

export function pathToMessage(
  messages: MessageRecord[],
  messageId: string,
): MessageRecord[] {
  const byId = new Map(messages.map((m) => [m.id, m]));
  const path: MessageRecord[] = [];
  let current = byId.get(messageId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function visiblePath(
  messages: MessageRecord[],
  currentMessageId: string | null,
  sessionId: string,
): MessageRecord[] {
  const current = currentMessageId
    ? messages.find(
        (m) => m.id === currentMessageId && m.sessionId === sessionId,
      )
    : latestLeaf(messages, sessionId);
  return current ? pathToMessage(messages, current.id) : [];
}

export function collectDescendants(
  messages: MessageRecord[],
  parentId: string,
  sessionId: string,
): MessageRecord[] {
  const result: MessageRecord[] = [];
  const stack = children(messages, parentId, sessionId).slice().reverse();
  while (stack.length) {
    const item = stack.pop()!;
    result.push(item);
    stack.push(...children(messages, item.id, sessionId).reverse());
  }
  return result.sort(compareByCreatedThenId);
}

export function validateParent(
  messages: MessageRecord[],
  child: MessageRecord,
): boolean {
  if (!child.parentId) return true;
  const parent = messages.find((m) => m.id === child.parentId);
  return (
    !!parent &&
    parent.sessionId === child.sessionId &&
    parent.createdAt <= child.createdAt
  );
}
