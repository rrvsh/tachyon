import {
  messageId,
  now,
  shortId,
  type MessageRecord,
  type SessionRecord,
} from "../data/schema";
import { collectDescendants, pathToMessage, visiblePath } from "./tree";

export function makeSession(title = "Untitled"): SessionRecord {
  const ts = now();
  return {
    id: shortId(),
    title,
    createdAt: ts,
    updatedAt: ts,
    archived: false,
    rootMessageId: null,
  };
}

export function makeMessage(input: {
  sessionId: string;
  role: "user" | "assistant";
  content?: string;
  parentId: string | null;
  finalized?: boolean;
  createdAt?: number;
}): MessageRecord {
  const ts = input.createdAt ?? now();
  return {
    id: messageId(),
    sessionId: input.sessionId,
    role: input.role,
    content: input.content ?? "",
    parentId: input.parentId,
    createdAt: ts,
    updatedAt: ts,
    finalized: input.finalized ?? input.role === "user",
  };
}

export function copyPathToNewSession(
  path: MessageRecord[],
  targetContent?: { id: string; content: string },
): {
  session: SessionRecord;
  messages: MessageRecord[];
  idMap: Map<string, string>;
} {
  const session = makeSession(path[0]?.content.slice(0, 40) || "Fork");
  const idMap = new Map<string, string>();
  const messages = path.map((old, index) => {
    const id = messageId();
    idMap.set(old.id, id);
    const ts = now() + index;
    return {
      ...old,
      id,
      sessionId: session.id,
      parentId: old.parentId ? (idMap.get(old.parentId) ?? null) : null,
      content:
        targetContent?.id === old.id ? targetContent.content : old.content,
      createdAt: ts,
      updatedAt: ts,
    };
  });
  session.rootMessageId = messages[0]?.id ?? null;
  session.updatedAt = now();
  return { session, messages, idMap };
}

export function editInPlace(
  messages: MessageRecord[],
  currentId: string,
  targetId: string,
  newContent: string,
): { newMessages: MessageRecord[]; selectedId: string } {
  const path = visiblePath(
    messages,
    currentId,
    messages.find((m) => m.id === currentId)?.sessionId ?? "",
  );
  const start = path.findIndex((m) => m.id === targetId);
  if (start < 0) throw new Error("Target is not on visible path.");
  const copied: MessageRecord[] = [];
  const idMap = new Map<string, string>();
  for (const old of path.slice(start)) {
    const id = messageId();
    idMap.set(old.id, id);
    const parentId =
      old.id === targetId
        ? old.parentId
        : (idMap.get(old.parentId ?? "") ?? old.parentId);
    const ts = now() + copied.length;
    copied.push({
      ...old,
      id,
      parentId,
      content: old.id === targetId ? newContent : old.content,
      deletedAt: old.id === targetId ? undefined : old.deletedAt,
      reasoning: old.id === targetId ? undefined : old.reasoning,
      reasoningDetails: old.id === targetId ? undefined : old.reasoningDetails,
      createdAt: ts,
      updatedAt: ts,
      finalized: old.role === "user" ? true : old.finalized,
    });
  }
  return { newMessages: copied, selectedId: copied.at(-1)!.id };
}

export function editWithSubtree(
  messages: MessageRecord[],
  currentId: string,
  targetId: string,
  newContent: string,
  cloneFollowing = true,
): { newMessages: MessageRecord[]; selectedId: string } {
  const target = messages.find((m) => m.id === targetId);
  if (!target) throw new Error("Target message was not found.");
  const visible = visiblePath(messages, currentId, target.sessionId);
  if (!visible.some((m) => m.id === targetId))
    throw new Error("Target is not on visible path.");

  const source = cloneFollowing
    ? [target, ...collectDescendants(messages, target.id, target.sessionId)]
    : [target];
  const idMap = new Map<string, string>();
  const copied = source.map((old, index) => {
    const id = messageId();
    idMap.set(old.id, id);
    const ts = now() + index;
    return {
      ...old,
      id,
      parentId: old.id === target.id ? old.parentId : idMap.get(old.parentId!)!,
      content: old.id === target.id ? newContent : old.content,
      deletedAt: old.id === target.id ? undefined : old.deletedAt,
      reasoning: old.id === target.id ? undefined : old.reasoning,
      reasoningDetails: old.id === target.id ? undefined : old.reasoningDetails,
      createdAt: ts,
      updatedAt: ts,
      finalized: old.role === "user" ? true : old.finalized,
    };
  });
  return {
    newMessages: copied,
    selectedId: cloneFollowing
      ? (idMap.get(currentId) ?? copied[0].id)
      : copied[0].id,
  };
}

export function regenerateAssistant(target: MessageRecord): MessageRecord {
  if (target.role !== "assistant")
    throw new Error("Only assistant messages can be regenerated.");
  return makeMessage({
    sessionId: target.sessionId,
    role: "assistant",
    content: "",
    parentId: target.parentId,
    finalized: false,
  });
}

export function deriveTitle(text: string): string {
  return text.trim().slice(0, 50) || "Assistant request";
}

export function requestParentForRegeneration(
  messages: MessageRecord[],
  assistantId: string,
): MessageRecord | null {
  const target = messages.find((m) => m.id === assistantId);
  if (!target || target.role !== "assistant" || !target.parentId) return null;
  return messages.find((m) => m.id === target.parentId) ?? null;
}
