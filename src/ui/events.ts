import {
  abortViewed,
  analyzeImportJsonText,
  archiveAgent,
  archiveSession,
  currentSettings,
  deleteMessage,
  duplicateAgent,
  editMessage,
  exportJson,
  forkMessage,
  importJsonText,
  newSession,
  openSession,
  regenerate,
  replaceJsonText,
  saveAgent,
  selectBranch,
  send,
  updateSettings,
  viewedHasInflight,
} from "../app/actions";
import { clearNotice, loadState } from "../app/state";
import { normalizeMessageForDisplay } from "../messages/display";
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
  app.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const dismiss = target.getAttribute("data-dismiss-notice");
    if (dismiss) {
      const [kind, index] = dismiss.split(":");
      if ((kind === "error" || kind === "info") && index) {
        target.classList.add("dismissing");
        window.setTimeout(() => clearNotice(Number(index), kind), 180);
      }
      return;
    }
    const rightTab = target.getAttribute("data-right-tab");
    if (rightTab) {
      app.dataset.rightSidebarTab = rightTab;
      return refresh();
    }
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
    const agentDuplicate = target.getAttribute("data-agent-duplicate");
    if (agentDuplicate)
      return void duplicateAgent(agentDuplicate).then(refresh);
    const agentEdit = target.getAttribute("data-agent-edit");
    if (agentEdit) {
      app.dataset.agentFormMode = "edit";
      app.dataset.agentFormId = agentEdit;
      return refresh();
    }
    if (target.matches("[data-agent-create]")) {
      app.dataset.agentFormMode = "create";
      delete app.dataset.agentFormId;
      return refresh();
    }
    if (target.matches("[data-agent-form-cancel]")) {
      delete app.dataset.agentFormMode;
      delete app.dataset.agentFormId;
      return refresh();
    }
    if (target.matches("[data-import-merge]")) {
      const text = app.dataset.importReviewText;
      if (text) await importJsonText(text);
      delete app.dataset.importReview;
      delete app.dataset.importReviewText;
      return refresh();
    }
    if (target.matches("[data-import-replace]")) {
      const text = app.dataset.importReviewText;
      if (text) await replaceJsonText(text);
      delete app.dataset.importReview;
      delete app.dataset.importReviewText;
      return refresh();
    }
    if (target.matches("[data-copy-conversation]"))
      return void copyConversationText(target);
    const copy = target.getAttribute("data-copy");
    if (copy) return void copyMessageText(copy, target);
    const edit = target.getAttribute("data-edit");
    if (edit) {
      const state = await loadState();
      const message = state.messages.find((m) => m.id === edit);
      const content = target
        .closest<HTMLElement>(".message-card")
        ?.querySelector<HTMLElement>("[data-message-content]");
      app.dataset.editingMessageId = edit;
      app.dataset.editingDraft = message?.content ?? "";
      app.dataset.editingHeight = String(
        Math.max(48, Math.ceil(content?.getBoundingClientRect().height ?? 128)),
      );
      return refresh();
    }
    const cancelEdit = target.hasAttribute("data-cancel-edit");
    if (cancelEdit) {
      clearEditing(app);
      return refresh();
    }
    const saveEdit = target.getAttribute("data-save-edit");
    const saveResend = target.getAttribute("data-save-resend");
    if (saveEdit || saveResend) {
      const id = saveEdit || saveResend!;
      const textarea = app.querySelector<HTMLTextAreaElement>(
        `[data-edit-textarea="${CSS.escape(id)}"]`,
      );
      await editMessage(
        id,
        textarea?.value ?? app.dataset.editingDraft ?? "",
        !!saveResend,
      );
      clearEditing(app);
      return refresh();
    }
    const fork = target.getAttribute("data-fork");
    if (fork) return void forkMessage(fork).then(refresh);
    const del = target.getAttribute("data-delete");
    if (del) return void deleteMessage(del, true).then(refresh);
    const restore = target.getAttribute("data-restore");
    if (restore) return void deleteMessage(restore, false).then(refresh);
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
      const selected = sibs[idx + (prev ? -1 : 1)];
      if (!selected) return;
      preserveVariantScroll(app, target, selected.id, event);
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
      const saved = await saveAgent({
        id: String(fd.get("id") || "") || undefined,
        name: String(fd.get("name") ?? ""),
        model: String(fd.get("model") ?? ""),
        systemPrompt: String(fd.get("systemPrompt") ?? ""),
        params: collectParams(form),
      });
      if (saved) {
        delete app.dataset.agentFormMode;
        delete app.dataset.agentFormId;
      }
      refresh();
    }
  });
  app.addEventListener("keydown", async (event) => {
    const target = event.target as HTMLElement;
    if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
    if (target.matches("[data-edit-textarea]")) {
      event.preventDefault();
      const id = (target as HTMLTextAreaElement).dataset.editTextarea;
      if (!id) return;
      const selector = event.shiftKey ? "data-save-resend" : "data-save-edit";
      app
        .querySelector<HTMLElement>(`[${selector}="${CSS.escape(id)}"]`)
        ?.click();
      return;
    }
    if (target.matches(".composer textarea")) {
      event.preventDefault();
      target.closest<HTMLFormElement>("form")?.requestSubmit();
    }
  });
  app.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-edit-textarea]")) {
      app.dataset.editingDraft = (target as HTMLTextAreaElement).value;
    }
    previewFontChange(target);
  });
  app.addEventListener("change", async (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-composer-agent]")) {
      const settings = currentSettings();
      updateSettings(
        settings.apiKey,
        (target as HTMLSelectElement).value || null,
        settings.fontFamily,
        settings.openThinkingByDefault,
        settings.leftSidebarCollapsed,
        settings.rightSidebarCollapsed,
      );
      refresh();
      return;
    }
    if (target.matches("[data-open-thinking-default]")) {
      const settings = currentSettings();
      updateSettings(
        settings.apiKey,
        settings.selectedAgentId,
        settings.fontFamily,
        (target as HTMLSelectElement).value === "open",
        settings.leftSidebarCollapsed,
        settings.rightSidebarCollapsed,
      );
      refresh();
      return;
    }
    if (target.matches('[data-action="import"]')) {
      const input = target as HTMLInputElement;
      if (input.files?.[0]) {
        const text = await input.files[0].text();
        const review = await analyzeImportJsonText(text);
        const { file: _file, ...reviewSummary } = review;
        void _file;
        app.dataset.importReviewText = text;
        app.dataset.importReview = JSON.stringify(reviewSummary);
        app.dataset.rightSidebarTab = "data";
        refresh();
      }
    }
    previewFontChange(target);
  });
  app.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const rightSidebarToggle = target.closest<HTMLElement>(
      "[data-toggle-right-sidebar]",
    );
    if (rightSidebarToggle) {
      const settings = currentSettings();
      const collapsed = !(app.dataset.rightSidebarCollapsed !== "false");
      updateSettings(
        settings.apiKey,
        settings.selectedAgentId,
        settings.fontFamily,
        settings.openThinkingByDefault,
        settings.leftSidebarCollapsed,
        collapsed,
      );
      animateRightSidebarToggle(app, rightSidebarToggle, collapsed);
      return;
    }
    if (target.matches("[data-save-settings]")) {
      const root = target.closest("dialog") ?? app;
      const api = (
        root.querySelector("[data-setting-api-key]") as HTMLInputElement
      ).value;
      const font = (
        root.querySelector("[data-setting-font]") as HTMLSelectElement
      ).value;
      const settings = currentSettings();
      updateSettings(
        api,
        settings.selectedAgentId,
        font,
        settings.openThinkingByDefault,
        settings.leftSidebarCollapsed,
        settings.rightSidebarCollapsed,
      );
      if (root instanceof HTMLDialogElement)
        root.dataset.settingsSaved = "true";
      refresh();
    }
  });
}

function animateRightSidebarToggle(
  app: HTMLElement,
  button: HTMLElement,
  collapsed: boolean,
): void {
  const shell = app.querySelector<HTMLElement>(".app-shell");
  const sidebar = app.querySelector<HTMLElement>(".right-sidebar");
  const icon = button.querySelector<HTMLElement>(
    "[data-right-sidebar-toggle-icon]",
  );
  const label = collapsed ? "expand right sidebar" : "collapse right sidebar";

  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  icon?.classList.toggle("collapsed", collapsed);
  sidebar?.setAttribute("aria-hidden", String(collapsed));
  if (!collapsed) sidebar?.removeAttribute("inert");
  shell?.classList.toggle("right-sidebar-collapsed", collapsed);
  sidebar?.classList.toggle("collapsed", collapsed);
  app.dataset.rightSidebarCollapsed = String(collapsed);

  window.setTimeout(() => {
    if (collapsed) sidebar?.setAttribute("inert", "");
  }, 180);
}

function preserveVariantScroll(
  app: HTMLElement,
  target: HTMLElement,
  nextMessageId: string,
  event: MouseEvent,
): void {
  const row = target.closest<HTMLElement>("[data-message-id]");
  if (!row) return;
  const rect = row.getBoundingClientRect();
  app.dataset.preserveScrollMessageId = nextMessageId;
  app.dataset.preserveScrollViewportY = String(event.clientY);
  app.dataset.preserveScrollOffsetY = String(event.clientY - rect.top);
}

function clearEditing(app: HTMLElement): void {
  delete app.dataset.editingMessageId;
  delete app.dataset.editingDraft;
  delete app.dataset.editingHeight;
}

async function copyMessageText(id: string, target: HTMLElement): Promise<void> {
  const state = await loadState();
  const message = state.messages.find((m) => m.id === id);
  if (!message) return;
  await writeClipboard(normalizeMessageForDisplay(message).visibleContent);
  flashCopied(target);
}

async function copyConversationText(target: HTMLElement): Promise<void> {
  const state = await loadState();
  const messages = state.visible.filter((m) => !m.deletedAt);
  const body = messages
    .map((message) => {
      const content = normalizeMessageForDisplay(message).visibleContent.trim();
      return `${message.role}:\n${content}`;
    })
    .join("\n\n");
  const metadata = [
    `session: ${state.session?.id ?? "new session"}`,
    `copied: ${new Date().toISOString()}`,
  ].join("\n");
  await writeClipboard(`${metadata}\n\n${body}`.trimEnd());
  flashCopied(target);
}

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function flashCopied(target: HTMLElement): void {
  const previous = target.textContent ?? "copy";
  const previousLabel = target.getAttribute("aria-label");
  target.textContent = "copied!";
  target.setAttribute("aria-label", "copied!");
  window.setTimeout(() => {
    target.textContent = previous;
    if (previousLabel) target.setAttribute("aria-label", previousLabel);
  }, 900);
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
  const font = dialog.querySelector("[data-setting-font]") as HTMLSelectElement;
  api.value = settings.apiKey;
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
