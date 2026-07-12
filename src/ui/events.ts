import {
  abortViewed,
  archiveAgent,
  archiveSession,
  editMessage,
  exportJson,
  forkMessage,
  getAgent,
  importJsonText,
  newSession,
  openSession,
  regenerate,
  saveAgent,
  selectBranch,
  send,
  updateSettings,
  viewedHasInflight,
} from "../app/actions";
import { loadState } from "../app/state";
import { siblings } from "../messages/tree";

export function bindEvents(app: HTMLElement): void {
  app.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const open = target.getAttribute("data-open-session");
    if (open) return openSession(open);
    if (target.matches('[data-action="new-session"]')) return newSession();
    if (target.matches('[data-action="export"]')) return void exportJson();
    const archive = target.getAttribute("data-archive-session");
    if (archive) return void archiveSession(archive, true).then(refresh);
    const unarchive = target.getAttribute("data-unarchive-session");
    if (unarchive) return void archiveSession(unarchive, false).then(refresh);
    const agentArchive = target.getAttribute("data-agent-archive");
    if (agentArchive)
      return void archiveAgent(
        agentArchive,
        target.textContent !== "restore",
      ).then(refresh);
    const agentEdit = target.getAttribute("data-agent-edit");
    if (agentEdit) {
      const agent = await getAgent(agentEdit);
      if (!agent) return;
      const name = prompt("Agent name?", agent.name);
      if (name === null) return;
      const model = prompt("Agent model?", agent.model);
      if (model === null) return;
      const systemPrompt = prompt("System prompt?", agent.systemPrompt);
      if (systemPrompt === null) return;
      const params = prompt("Params JSON?", JSON.stringify(agent.params));
      if (params === null) return;
      await saveAgent({
        id: agent.id,
        name,
        model,
        systemPrompt,
        params,
        archived: agent.archived,
      });
      return refresh();
    }
    const edit = target.getAttribute("data-edit");
    if (edit) {
      const content = prompt("New content?");
      if (content !== null) await editMessage(edit, content);
      return refresh();
    }
    const fork = target.getAttribute("data-fork");
    if (fork) return void forkMessage(fork).then(refresh);
    const editFork = target.getAttribute("data-edit-fork");
    if (editFork) {
      const content = prompt("Edited fork content?");
      if (content !== null)
        await forkMessage(
          editFork,
          content,
          confirm("Resend from edited message?"),
        );
      return refresh();
    }
    const regen = target.getAttribute("data-regenerate");
    if (regen) return void regenerate(regen).then(refresh);
    const prev = target.getAttribute("data-branch-prev");
    const next = target.getAttribute("data-branch-next");
    if (prev || next) {
      const state = await loadState();
      const current = state.messages.find((m) => m.id === (prev || next));
      if (!current) return;
      const sibs = siblings(state.messages, current);
      const idx = sibs.findIndex((s) => s.id === current.id);
      const selected =
        sibs[(idx + (prev ? -1 : 1) + sibs.length) % sibs.length];
      await selectBranch(selected.id);
      return refresh();
    }
  });
  app.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    if (form.matches("[data-compose]")) {
      if (viewedHasInflight()) abortViewed();
      else await send(new FormData(form).get("message")?.toString() ?? "");
      (form.querySelector("textarea") as HTMLTextAreaElement).value = "";
      refresh();
    }
    if (form.matches("[data-agent-form]")) {
      const fd = new FormData(form);
      await saveAgent({
        name: String(fd.get("name") ?? ""),
        model: String(fd.get("model") ?? ""),
        systemPrompt: String(fd.get("systemPrompt") ?? ""),
        params: String(fd.get("params") ?? ""),
      });
      refresh();
    }
  });
  app.addEventListener("change", async (event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches('[data-action="import"]') && target.files?.[0]) {
      await importJsonText(await target.files[0].text());
      refresh();
    }
  });
  app.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-save-settings]")) {
      const api = (
        app.querySelector("[data-setting-api-key]") as HTMLInputElement
      ).value;
      const agent =
        (app.querySelector("[data-setting-agent]") as HTMLSelectElement)
          .value || null;
      updateSettings(api, agent);
      refresh();
    }
  });
}

function refresh(): void {
  window.dispatchEvent(new CustomEvent("app:changed"));
}
