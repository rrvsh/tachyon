import { assertValidAgentConfig, makeAgent } from "../agents/agents";
import {
  analyzeImport,
  createExport,
  importFile,
  replaceImport,
} from "../data/importExport";
import { getMessagesBySession, getOne, putOne, transactPut } from "../data/db";
import type { AgentRecord, MessageRecord, SessionRecord } from "../data/schema";
import { copyPathToNewSession, editWithSubtree } from "../messages/operations";
import { latestDescendant, latestLeaf, pathToMessage } from "../messages/tree";
import { abortRequest, hasInflight, startRequest } from "../requests/lifecycle";
import {
  applyFontFamily,
  getSettings,
  saveSettings,
  setCurrentPointer,
} from "../settings/settings";
import { notify, sessionIdFromUrl } from "./state";

export async function send(text: string): Promise<void> {
  try {
    await startRequest({
      sessionId: sessionIdFromUrl(),
      parentId: await currentMessageId(),
      text,
      notify,
    });
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error), "error");
  }
}

async function currentMessageId(): Promise<string | null> {
  const sid = sessionIdFromUrl();
  if (!sid) return null;
  const messages = await getMessagesBySession(sid);
  const { getCurrentPointer } = await import("../settings/settings");
  const pointer = getCurrentPointer(sid);
  return pointer && messages.some((m) => m.id === pointer)
    ? pointer
    : (latestLeaf(messages, sid)?.id ?? null);
}

export function abortViewed(): void {
  const sid = sessionIdFromUrl();
  if (sid) abortRequest(sid);
}
export function viewedHasInflight(): boolean {
  const sid = sessionIdFromUrl();
  return !!sid && hasInflight(sid);
}
export function newSession(): void {
  history.pushState(
    null,
    "",
    location.pathname +
      (new URLSearchParams(location.search).has("debug") ? "?debug=1" : ""),
  );
  window.dispatchEvent(new CustomEvent("app:changed"));
}
export function openSession(id: string): void {
  const p = new URLSearchParams(location.search);
  p.set("session", id);
  history.pushState(null, "", `?${p.toString()}`);
  window.dispatchEvent(new CustomEvent("app:changed"));
}

export async function archiveSession(
  id: string,
  archived: boolean,
): Promise<void> {
  const s = await getOne<SessionRecord>("sessions", id);
  if (s) await putOne("sessions", { ...s, archived, updatedAt: Date.now() });
}
export async function selectBranch(messageId: string): Promise<void> {
  const msg = await getOne<MessageRecord>("messages", messageId);
  if (!msg) return;
  const all = await getMessagesBySession(msg.sessionId);
  const leaf = latestDescendant(all, msg);
  setCurrentPointer(msg.sessionId, leaf.id);
}

export async function editMessage(
  targetId: string,
  content: string,
  resend = false,
): Promise<void> {
  const sid = sessionIdFromUrl();
  if (!sid) return;
  const messages = await getMessagesBySession(sid);
  const current = (await currentMessageId()) ?? targetId;
  const result = editWithSubtree(messages, current, targetId, content, !resend);
  await transactPut({ messages: result.newMessages });
  setCurrentPointer(sid, result.selectedId);
  if (resend) {
    try {
      await startRequest({
        sessionId: sid,
        parentId: result.selectedId,
        text: "",
        notify,
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    }
  }
}

export async function deleteMessage(
  targetId: string,
  deleted: boolean,
): Promise<void> {
  const target = await getOne<MessageRecord>("messages", targetId);
  if (!target) return;
  await putOne("messages", {
    ...target,
    deletedAt: deleted ? Date.now() : undefined,
    updatedAt: Date.now(),
  });
}

export async function forkMessage(
  targetId: string,
  editedContent?: string,
  resend = false,
): Promise<void> {
  const sid = sessionIdFromUrl();
  if (!sid) return;
  const messages = await getMessagesBySession(sid);
  const path = pathToMessage(messages, targetId);
  const {
    session,
    messages: copied,
    idMap,
  } = copyPathToNewSession(
    path,
    editedContent ? { id: targetId, content: editedContent } : undefined,
  );
  await transactPut({ sessions: [session], messages: copied });
  openSession(session.id);
  setCurrentPointer(
    session.id,
    idMap.get(targetId) ?? copied.at(-1)?.id ?? null,
  );
  if (resend)
    await startRequest({
      sessionId: session.id,
      parentId: idMap.get(targetId) ?? null,
      text: "",
      notify,
    });
}

export async function regenerate(targetId: string): Promise<void> {
  const target = await getOne<MessageRecord>("messages", targetId);
  if (!target || target.role !== "assistant") return;
  try {
    await startRequest({
      sessionId: target.sessionId,
      parentId: target.parentId,
      text: "",
      notify,
    });
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error), "error");
  }
}

export async function saveAgent(form: {
  id?: string;
  name: string;
  model: string;
  systemPrompt: string;
  params: string | Record<string, unknown>;
  archived?: boolean;
}): Promise<boolean> {
  try {
    const params =
      typeof form.params === "string"
        ? form.params.trim()
          ? (JSON.parse(form.params) as Record<string, unknown>)
          : {}
        : form.params;
    const existing = form.id
      ? await getOne<AgentRecord>("agents", form.id)
      : undefined;
    const agent = makeAgent({
      ...existing,
      id: form.id ?? existing?.id,
      name: form.name,
      model: form.model,
      systemPrompt: form.systemPrompt,
      params,
      archived: form.archived ?? existing?.archived ?? false,
    });
    assertValidAgentConfig(agent);
    await putOne("agents", agent);
    return true;
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error), "error");
    return false;
  }
}

export async function archiveAgent(
  id: string,
  archived: boolean,
): Promise<void> {
  const a = await getOne<AgentRecord>("agents", id);
  if (a) await putOne("agents", { ...a, archived, updatedAt: Date.now() });
}

export async function duplicateAgent(id: string): Promise<void> {
  const a = await getOne<AgentRecord>("agents", id);
  if (!a) return;
  await putOne(
    "agents",
    makeAgent({
      name: `${a.name} copy`,
      model: a.model,
      systemPrompt: a.systemPrompt,
      params: a.params,
      archived: false,
    }),
  );
}
export async function getAgent(id: string): Promise<AgentRecord | undefined> {
  return getOne<AgentRecord>("agents", id);
}
export function updateSettings(
  apiKey: string,
  selectedAgentId: string | null,
  fontFamily: string,
  openThinkingByDefault: boolean,
  leftSidebarCollapsed = currentSettings().leftSidebarCollapsed,
  rightSidebarCollapsed = currentSettings().rightSidebarCollapsed,
): void {
  saveSettings({
    apiKey,
    selectedAgentId,
    fontFamily,
    openThinkingByDefault,
    leftSidebarCollapsed,
    rightSidebarCollapsed,
  });
  applyFontFamily(fontFamily);
}
export function currentSettings() {
  return getSettings();
}

export async function exportJson(): Promise<void> {
  const data = await createExport();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.download = `tachyon-export-${data.exportedAt}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
export async function analyzeImportJsonText(text: string) {
  try {
    return await analyzeImport(JSON.parse(text));
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
      quarantineReasons: [],
    };
  }
}

export async function importJsonText(text: string): Promise<void> {
  const result = await importFile(JSON.parse(text));
  notify(`Imported ${result.imported}, quarantined ${result.quarantined}.`);
}

export async function replaceJsonText(text: string): Promise<void> {
  const result = await replaceImport(JSON.parse(text));
  notify(`Replaced local data with ${result.imported} imported records.`);
}
