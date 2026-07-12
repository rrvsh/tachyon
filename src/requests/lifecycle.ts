import { assemblePayload, type OpenRouterMessage } from "../agents/agents";
import { getMessagesBySession, getOne, putOne, transactPut } from "../data/db";
import type { AgentRecord, MessageRecord, SessionRecord } from "../data/schema";
import { makeMessage, makeSession, deriveTitle } from "../messages/operations";
import { pathToMessage } from "../messages/tree";
import { getSettings, setCurrentPointer } from "../settings/settings";
import { debugTransport } from "./debug";
import { openRouterTransport } from "./openrouter";
import { isAbort, type Transport } from "./transport";

export interface RuntimeRequest {
  sessionId: string;
  assistantMessageId: string;
  abortController: AbortController;
  startedAt: number;
}
export const requestRegistry = new Map<string, RuntimeRequest>();
export type Notify = (message: string, kind?: "error" | "info") => void;

export function isDebugMode(): boolean {
  return new URLSearchParams(location.search).has("debug");
}
export function hasInflight(sessionId: string): boolean {
  return requestRegistry.has(sessionId);
}

export async function finalizeStaleUnfinalizedMessages(): Promise<void> {
  const { snapshot } = await import("../data/db");
  const snap = await snapshot();
  await Promise.all(
    snap.messages
      .filter(
        (m) =>
          m.role === "assistant" &&
          !m.finalized &&
          !requestRegistry.has(m.sessionId),
      )
      .map((m) =>
        putOne("messages", { ...m, finalized: true, updatedAt: Date.now() }),
      ),
  );
}

export async function startRequest(input: {
  sessionId: string | null;
  parentId: string | null;
  text: string;
  notify: Notify;
  transport?: Transport;
}): Promise<string> {
  const reservedSessionId = input.sessionId;
  const reserveController = new AbortController();
  if (reservedSessionId) {
    if (requestRegistry.has(reservedSessionId))
      throw new Error("This session already has an inflight request.");
    requestRegistry.set(reservedSessionId, {
      sessionId: reservedSessionId,
      assistantMessageId: "",
      abortController: reserveController,
      startedAt: Date.now(),
    });
  }

  try {
    const debug = isDebugMode();
    const settings = getSettings();
    const agent = settings.selectedAgentId
      ? await getOne<AgentRecord>("agents", settings.selectedAgentId)
      : undefined;
    if (!agent) throw new Error("Select an agent before starting a request.");
    if (!debug && !settings.apiKey)
      throw new Error("OpenRouter API key is required.");

    let session = input.sessionId
      ? await getOne<SessionRecord>("sessions", input.sessionId)
      : undefined;
    if (reservedSessionId && !session)
      requestRegistry.delete(reservedSessionId);
    const creatingSession = !session;

    const existingMessages = session
      ? await getMessagesBySession(session.id)
      : [];
    const parent = input.parentId
      ? existingMessages.find((m) => m.id === input.parentId)
      : null;
    if (input.parentId && !parent)
      throw new Error("Selected parent message is invalid.");

    const requestMessages: MessageRecord[] = [];
    if (!session) session = makeSession(deriveTitle(input.text));
    const sessionId = session.id;
    if (!reservedSessionId && requestRegistry.has(sessionId))
      throw new Error("This session already has an inflight request.");

    let requestParentId = parent?.id ?? null;
    if (input.text.trim()) {
      const user = makeMessage({
        sessionId,
        role: "user",
        content: input.text.trim(),
        parentId: requestParentId,
        finalized: true,
      });
      requestMessages.push(user);
      requestParentId = user.id;
      if (!session.rootMessageId) session.rootMessageId = user.id;
    }
    const assistant = makeMessage({
      sessionId,
      role: "assistant",
      content: "",
      parentId: requestParentId,
      finalized: false,
      createdAt: Date.now() + 1,
    });
    requestMessages.push(assistant);
    if (!session.rootMessageId) session.rootMessageId = assistant.id;
    session.title =
      session.title === "Untitled" ? deriveTitle(input.text) : session.title;
    session.updatedAt = Date.now();

    const path = parent ? pathToMessage(existingMessages, parent.id) : [];
    const contextRecords = [
      ...path,
      ...requestMessages.filter((m) => m.role === "user"),
    ];
    const context: OpenRouterMessage[] = contextRecords.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const payload = assemblePayload(agent, context);

    await transactPut({ sessions: [session], messages: requestMessages });
    setCurrentPointer(sessionId, assistant.id);
    if (creatingSession)
      history.pushState(
        null,
        "",
        `?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), session: sessionId }).toString()}`,
      );

    const abortController = reservedSessionId
      ? reserveController
      : new AbortController();
    requestRegistry.set(sessionId, {
      sessionId,
      assistantMessageId: assistant.id,
      abortController,
      startedAt: Date.now(),
    });
    const transport =
      input.transport ?? (debug ? debugTransport : openRouterTransport);
    void transport
      .stream(
        { payload, apiKey: settings.apiKey, signal: abortController.signal },
        async (delta) => {
          const current = await getOne<MessageRecord>("messages", assistant.id);
          if (!current || current.finalized) return;
          const updated = {
            ...current,
            content: current.content + delta,
            updatedAt: Date.now(),
          };
          await putOne("messages", updated);
          window.dispatchEvent(
            new CustomEvent("app:stream-updated", {
              detail: { messageId: assistant.id, content: updated.content },
            }),
          );
        },
      )
      .then(async () => finalizeRequest(sessionId, assistant.id))
      .catch(async (error: unknown) => {
        if (!isAbort(error))
          input.notify(
            error instanceof Error ? error.message : String(error),
            "error",
          );
        await finalizeRequest(sessionId, assistant.id);
      });
    window.dispatchEvent(new CustomEvent("app:changed"));
    return sessionId;
  } catch (error) {
    if (reservedSessionId) requestRegistry.delete(reservedSessionId);
    throw error;
  }
}

export async function finalizeRequest(
  sessionId: string,
  assistantId: string,
): Promise<void> {
  const entry = requestRegistry.get(sessionId);
  if (!entry || entry.assistantMessageId !== assistantId) return;
  requestRegistry.delete(sessionId);
  const msg = await getOne<MessageRecord>("messages", assistantId);
  if (msg && !msg.finalized)
    await putOne("messages", {
      ...msg,
      finalized: true,
      updatedAt: Date.now(),
    });
  window.dispatchEvent(new CustomEvent("app:changed"));
}

export function abortRequest(sessionId: string): void {
  const entry = requestRegistry.get(sessionId);
  if (entry) entry.abortController.abort();
}
