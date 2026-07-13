import {
  abortViewed,
  archiveAgent,
  archiveSession,
  currentSettings,
  editMessage,
  exportJson,
  forkMessage,
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
import { applyFontFamily } from "../settings/settings";

export function bindEvents(app: HTMLElement): void {
  app.addEventListener(
    "wheel",
    (event) => {
      if (event.deltaY < 0) {
        app.dataset.autoscroll = "false";
        app.dataset.lastUserScrollAt = String(Date.now());
      }
    },
    { capture: true, passive: true },
  );
  app.addEventListener(
    "touchmove",
    () => {
      app.dataset.autoscroll = "false";
      app.dataset.lastUserScrollAt = String(Date.now());
    },
    { capture: true, passive: true },
  );
  app.addEventListener(
    "close",
    (event) => {
      const dialog = event.target as HTMLDialogElement;
      if (
        dialog.id === "settings-dialog" &&
        dialog.dataset.settingsSaved !== "true"
      ) {
        resetSettingsDialog(dialog);
      }
    },
    true,
  );
  app.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("dialog.modal")) {
      (target as HTMLDialogElement).close();
      return;
    }
    if (target.matches("[data-close-dialog]")) {
      target.closest("dialog")?.close();
      return;
    }
    const dialogId = target.getAttribute("data-open-dialog");
    if (dialogId) return openDialog(dialogId);
    if (target.matches("[data-add-param]")) return addExtraParamRow(app);
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
        target.getAttribute("aria-label") !== "Restore agent",
      ).then(refresh);
    const agentEdit = target.getAttribute("data-agent-edit");
    if (agentEdit) {
      populateAgentForm(target);
      return openDialog("agents-dialog");
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
        id: String(fd.get("id") || "") || undefined,
        name: String(fd.get("name") ?? ""),
        model: String(fd.get("model") ?? ""),
        systemPrompt: String(fd.get("systemPrompt") ?? ""),
        params: collectParams(form),
      });
      refresh();
    }
  });
  app.addEventListener("input", (event) => {
    previewFontChange(event.target as HTMLElement);
  });
  app.addEventListener("change", async (event) => {
    const target = event.target as HTMLElement;
    if (target.matches('[data-action="import"]')) {
      const input = target as HTMLInputElement;
      if (input.files?.[0]) {
        await importJsonText(await input.files[0].text());
        refresh();
      }
    }
    previewFontChange(target);
  });
  app.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-save-settings]")) {
      const root = target.closest("dialog") ?? app;
      const api = (
        root.querySelector("[data-setting-api-key]") as HTMLInputElement
      ).value;
      const agent =
        (root.querySelector("[data-setting-agent]") as HTMLSelectElement)
          .value || null;
      const font = (
        root.querySelector("[data-setting-font]") as HTMLSelectElement
      ).value;
      updateSettings(api, agent, font);
      if (root instanceof HTMLDialogElement)
        root.dataset.settingsSaved = "true";
      refresh();
    }
  });
}

function previewFontChange(target: HTMLElement): void {
  if (!target.matches("[data-setting-font]")) return;
  const dialog = target.closest<HTMLDialogElement>("#settings-dialog");
  if (dialog) dialog.dataset.settingsSaved = "false";
  applyFontFamily((target as HTMLSelectElement).value);
}

function resetSettingsDialog(dialog: HTMLDialogElement): void {
  const settings = currentSettings();
  const api = dialog.querySelector(
    "[data-setting-api-key]",
  ) as HTMLInputElement;
  const agent = dialog.querySelector(
    "[data-setting-agent]",
  ) as HTMLSelectElement;
  const font = dialog.querySelector("[data-setting-font]") as HTMLSelectElement;
  api.value = settings.apiKey;
  agent.value = settings.selectedAgentId ?? "";
  font.value = settings.fontFamily;
  applyFontFamily(settings.fontFamily);
}

function openDialog(id: string): void {
  const dialog = document.getElementById(id) as HTMLDialogElement | null;
  if (!dialog || dialog.open) return;
  if (id === "settings-dialog") dialog.dataset.settingsSaved = "true";
  dialog.showModal();
}

function addExtraParamRow(
  root: ParentNode,
  key = "",
  value = "",
): HTMLDivElement | null {
  const list = root.querySelector("[data-extra-param-list]");
  if (!list) return null;
  const row = document.createElement("div");
  row.className = "extra-param-row";
  row.innerHTML = `<input name="extraParamKey" placeholder="key"><input name="extraParamValue" placeholder="value or JSON"><button class="icon-button" type="button" aria-label="Remove field" title="Remove field">×</button>`;
  const [keyInput, valueInput] = row.querySelectorAll("input");
  keyInput.value = key;
  valueInput.value = value;
  row.querySelector("button")?.addEventListener("click", () => row.remove());
  list.append(row);
  return row;
}

function populateAgentForm(target: HTMLElement): void {
  const row = target.closest<HTMLElement>("[data-agent-id]");
  const form = document.querySelector(
    "[data-agent-form]",
  ) as HTMLFormElement | null;
  if (!row || !form) return;
  const params = JSON.parse(row.dataset.agentParams || "{}") as Record<
    string,
    unknown
  >;
  form.reset();
  (form.elements.namedItem("id") as HTMLInputElement).value =
    row.dataset.agentId ?? "";
  (form.elements.namedItem("name") as HTMLInputElement).value =
    row.dataset.agentName ?? "";
  (form.elements.namedItem("model") as HTMLInputElement).value =
    row.dataset.agentModel ?? "";
  (form.elements.namedItem("systemPrompt") as HTMLTextAreaElement).value =
    row.dataset.agentSystemPrompt ?? "";
  const commonKeys = new Set<string>();
  form
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-param-path]")
    .forEach((input) => {
      const key = input.dataset.paramPath!;
      commonKeys.add(key.split(".")[0]);
      input.value = stringifyParam(readPath(params, key));
    });
  const list = form.querySelector("[data-extra-param-list]");
  if (list) list.textContent = "";
  for (const [key, value] of Object.entries(params)) {
    if (!commonKeys.has(key))
      addExtraParamRow(form, key, stringifyParam(value));
  }
}

function collectParams(form: HTMLFormElement): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  form
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-param-path]")
    .forEach((input) => {
      if (!input.value.trim()) return;
      writePath(
        params,
        input.dataset.paramPath!,
        parseParam(input.value, input.type),
      );
    });
  const keys = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="extraParamKey"]'),
  );
  const values = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="extraParamValue"]'),
  );
  keys.forEach((keyInput, index) => {
    const key = keyInput.value.trim();
    const value = values[index]?.value.trim();
    if (key && value) params[key] = parseParam(value, "text");
  });
  return params;
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}

function writePath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1)!] = value;
}

function parseParam(value: string, type: string): unknown {
  const trimmed = value.trim();
  if (type === "number") return Number(trimmed);
  if (["true", "false"].includes(trimmed)) return trimmed === "true";
  if (trimmed === "null") return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("["))
    return JSON.parse(trimmed) as unknown;
  return trimmed;
}

function stringifyParam(value: unknown): string {
  if (value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function refresh(): void {
  window.dispatchEvent(new CustomEvent("app:changed"));
}
