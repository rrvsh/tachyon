import type { AppState } from "../app/state";
import { siblings } from "../messages/tree";
import { currentSettings, viewedHasInflight } from "../app/actions";

function esc(s: string): string {
  return s.replace(
    /[&<>\"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[c]!,
  );
}

export function render(app: HTMLElement, state: AppState): void {
  const settings = currentSettings();
  app.innerHTML = `
    <header><h1>OpenRouter Static Chat</h1><button data-action="new-session">New session</button><button data-action="export">Export</button><label>Import <input data-action="import" type="file" accept="application/json"></label></header>
    <main class="layout">
      <aside><h2>Sessions</h2><ul>${state.sessions.map((s) => `<li><button data-open-session="${s.id}">${esc(s.title)}</button><button data-archive-session="${s.id}">archive</button></li>`).join("")}</ul><details><summary>Archived</summary><ul>${state.archivedSessions.map((s) => `<li><button data-open-session="${s.id}">${esc(s.title)}</button><button data-unarchive-session="${s.id}">restore</button></li>`).join("")}</ul></details></aside>
      <section class="chat"><div class="notices">${state.errors.map((e) => `<p class="error">${esc(e)}</p>`).join("")}${state.info.map((e) => `<p>${esc(e)}</p>`).join("")}</div>${state.session ? renderMessages(state) : '<p data-testid="blank">Root blank state. Send a prompt or start assistant-only.</p>'}${renderComposer()}</section>
      <aside>${renderSettings(settings, state)}${renderAgents(state)}</aside>
    </main>`;
}

function renderMessages(state: AppState): string {
  return `<ol class="messages">${state.visible
    .map((m) => {
      const sibs = siblings(state.messages, m);
      const idx = sibs.findIndex((s) => s.id === m.id);
      return `<li data-message-id="${m.id}" class="message ${m.role}"><strong>${m.role}</strong><pre>${esc(m.content)}</pre><small>${m.finalized ? "finalized" : "streaming"}</small>${sibs.length > 1 ? `<div><button data-branch-prev="${m.id}">◀</button> ${idx + 1}/${sibs.length} <button data-branch-next="${m.id}">▶</button></div>` : ""}<div><button data-edit="${m.id}">Edit</button><button data-fork="${m.id}">Fork</button><button data-edit-fork="${m.id}">Edit+Fork</button>${m.role === "assistant" ? `<button data-regenerate="${m.id}">Regenerate</button>` : ""}</div></li>`;
    })
    .join("")}</ol>`;
}

function renderComposer(): string {
  const abort = viewedHasInflight();
  return `<form data-compose><textarea name="message" placeholder="Message (empty for assistant-only)"></textarea><button type="submit">${abort ? "Abort" : "Send"}</button></form>`;
}
function renderSettings(
  settings: { apiKey: string; selectedAgentId: string | null },
  state: AppState,
): string {
  return `<section><h2>Settings</h2><label>API key <input data-setting-api-key type="password" value="${esc(settings.apiKey)}"></label><label>Agent <select data-setting-agent><option value="">Select</option>${state.agents
    .filter((a) => !a.archived)
    .map(
      (a) =>
        `<option value="${a.id}" ${settings.selectedAgentId === a.id ? "selected" : ""}>${esc(a.name)}</option>`,
    )
    .join(
      "",
    )}</select></label><button data-save-settings>Save settings</button></section>`;
}
function renderAgents(state: AppState): string {
  return `<section><h2>Agents</h2><form data-agent-form><input name="name" placeholder="name"><input name="model" placeholder="model"><textarea name="systemPrompt" placeholder="system prompt"></textarea><textarea name="params" placeholder='{"temperature":0.7}'></textarea><button>Save agent</button></form><ul>${state.agents.map((a) => `<li>${esc(a.name)} <code>${esc(a.model)}</code> ${a.archived ? "archived" : ""}<button data-agent-edit="${a.id}">edit</button><button data-agent-archive="${a.id}">${a.archived ? "restore" : "archive"}</button></li>`).join("")}</ul></section>`;
}
