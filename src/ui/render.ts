import type { AgentRecord } from "../data/schema";
import type { AppState } from "../app/state";
import { normalizeMessageForDisplay } from "../messages/display";
import { siblings } from "../messages/tree";
import { currentSettings, viewedHasInflight } from "../app/actions";
import { composerDraftKey, readComposerDraft } from "./drafts";
import { FONT_OPTIONS } from "../settings/settings";
import { APP_COMMIT } from "../version";
import { getGithubSyncState } from "../sync/state";
import { resolveAgentProvider } from "../agents/providers";

export type ParamField = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  description: string;
  options?: Array<{ value: string; label: string }>;
};

export type ParamSection = { title: string; fields: ParamField[] };

export const openRouterParamSections: ParamSection[] = [
  {
    title: "sampling",
    fields: [
      {
        key: "temperature",
        label: "temperature (0.0 - 2.0)",
        type: "number",
        placeholder: "1.0",
        description: "Higher is more varied; lower is more predictable.",
      },
      {
        key: "top_p",
        label: "top_p (0.0 - 1.0)",
        type: "number",
        placeholder: "1.0",
        description: "Keeps only likely tokens up to this probability mass.",
      },
      {
        key: "top_k",
        label: "top_k (0+)",
        type: "number",
        placeholder: "0",
        description: "Keeps only the top K likely tokens; 0 disables it.",
      },
      {
        key: "frequency_penalty",
        label: "frequency_penalty (-2.0 - 2.0)",
        type: "number",
        placeholder: "0.0",
        description: "Penalizes tokens by how often they already appeared.",
      },
      {
        key: "presence_penalty",
        label: "presence_penalty (-2.0 - 2.0)",
        type: "number",
        placeholder: "0.0",
        description: "Penalizes tokens if they appeared at all.",
      },
      {
        key: "repetition_penalty",
        label: "repetition_penalty (0.0 - 2.0)",
        type: "number",
        placeholder: "1.0",
        description: "Discourages repetition; too high can hurt coherence.",
      },
      {
        key: "min_p",
        label: "min_p (0.0 - 1.0)",
        type: "number",
        placeholder: "0.0",
        description: "Drops tokens too unlikely relative to the best token.",
      },
      {
        key: "top_a",
        label: "top_a (0.0 - 1.0)",
        type: "number",
        placeholder: "0.0",
        description: "Filters tokens based on the strongest token probability.",
      },
    ],
  },
  {
    title: "length / repeatability",
    fields: [
      {
        key: "seed",
        label: "seed",
        type: "number",
        placeholder: "",
        description:
          "Attempts repeatable output with the same prompt and params.",
      },
      {
        key: "max_tokens",
        label: "max_tokens (1+)",
        type: "number",
        placeholder: "",
        description: "Maximum number of tokens to generate.",
      },
      {
        key: "max_completion_tokens",
        label: "max_completion_tokens (1+)",
        type: "number",
        placeholder: "",
        description: "Alternate max output token cap used by some models.",
      },
      {
        key: "stop",
        label: "stop",
        placeholder: '["END"]',
        description: "Stops generation when one of these strings is reached.",
      },
    ],
  },
  {
    title: "output shaping",
    fields: [
      {
        key: "logit_bias",
        label: "logit_bias",
        placeholder: '{"123":-100}',
        description: "Raises or lowers the chance of specific token IDs.",
      },
      {
        key: "logprobs",
        label: "logprobs",
        description: "Returns token log probabilities when supported.",
        options: [
          { value: "", label: "default" },
          { value: "true", label: "true" },
          { value: "false", label: "false" },
        ],
      },
      {
        key: "top_logprobs",
        label: "top_logprobs (0 - 20)",
        type: "number",
        placeholder: "",
        description:
          "How many likely tokens to return per position; needs logprobs.",
      },
      {
        key: "response_format",
        label: "response_format",
        placeholder: '{"type":"json_object"}',
        description: "Requests a shape such as JSON output when supported.",
      },
      {
        key: "structured_outputs",
        label: "structured_outputs",
        description:
          "Enables structured outputs for JSON schema response formats.",
        options: [
          { value: "", label: "default" },
          { value: "true", label: "true" },
          { value: "false", label: "false" },
        ],
      },
    ],
  },
  {
    title: "reasoning / verbosity / web",
    fields: [
      {
        key: "reasoning",
        label: "reasoning",
        description:
          "Controls thinking tokens for models that support reasoning.",
        options: [
          { value: "", label: "default" },
          { value: '{"enabled":true}', label: "enabled" },
          { value: '{"enabled":false}', label: "disabled" },
        ],
      },
      {
        key: "include_reasoning",
        label: "include_reasoning",
        description:
          "Deprecated reasoning flag; returns reasoning tokens when supported.",
        options: [
          { value: "", label: "default" },
          { value: "true", label: "true" },
          { value: "false", label: "false" },
        ],
      },
      {
        key: "reasoning_effort",
        label: "reasoning_effort",
        description: "OpenAI-style amount of reasoning effort to spend.",
        options: [
          { value: "", label: "default" },
          { value: "none", label: "none" },
          { value: "minimal", label: "minimal" },
          { value: "low", label: "low" },
          { value: "medium", label: "medium" },
          { value: "high", label: "high" },
          { value: "xhigh", label: "xhigh" },
        ],
      },
      {
        key: "verbosity",
        label: "verbosity",
        description:
          "Controls how concise or detailed supported models should be.",
        options: [
          { value: "", label: "default" },
          { value: "low", label: "low" },
          { value: "medium", label: "medium" },
          { value: "high", label: "high" },
          { value: "xhigh", label: "xhigh" },
          { value: "max", label: "max" },
        ],
      },
      {
        key: "web_search_options",
        label: "web_search_options",
        placeholder: "{}",
        description:
          "Native web search settings for models that support web access.",
      },
    ],
  },
  {
    title: "tools",
    fields: [
      {
        key: "tools",
        label: "tools",
        placeholder: "[]",
        description:
          "OpenAI-style tool definitions; local tool execution is not implemented.",
      },
      {
        key: "tool_choice",
        label: "tool_choice",
        placeholder: "auto",
        description: "Controls whether or which tool the model should call.",
      },
      {
        key: "parallel_tool_calls",
        label: "parallel_tool_calls",
        description:
          "Allows multiple tool calls at once when tools are supplied.",
        options: [
          { value: "", label: "default" },
          { value: "true", label: "true" },
          { value: "false", label: "false" },
        ],
      },
    ],
  },
  {
    title: "routing",
    fields: [
      {
        key: "models",
        label: "models",
        placeholder: '["openai/gpt-4o-mini"]',
        description: "Fallback model slugs to try if the primary model fails.",
      },
      {
        key: "provider.order",
        label: "provider.order",
        placeholder: '["anthropic","openai"]',
        description: "Provider slugs to try first, in order.",
      },
      {
        key: "provider.allow_fallbacks",
        label: "provider.allow_fallbacks",
        description: "Allows backup providers if the preferred one fails.",
        options: [
          { value: "", label: "default" },
          { value: "true", label: "true" },
          { value: "false", label: "false" },
        ],
      },
      {
        key: "provider.require_parameters",
        label: "provider.require_parameters",
        description:
          "Only routes to providers that support all supplied params.",
        options: [
          { value: "", label: "default" },
          { value: "true", label: "true" },
          { value: "false", label: "false" },
        ],
      },
      {
        key: "provider.data_collection",
        label: "provider.data_collection",
        description: "Controls use of providers that may store data.",
        options: [
          { value: "", label: "default" },
          { value: "allow", label: "allow" },
          { value: "deny", label: "deny" },
        ],
      },
      {
        key: "provider.zdr",
        label: "provider.zdr",
        description: "Restricts routing to zero-data-retention endpoints.",
        options: [
          { value: "", label: "default" },
          { value: "true", label: "true" },
          { value: "false", label: "false" },
        ],
      },
      {
        key: "provider.enforce_distillable_text",
        label: "provider.enforce_distillable_text",
        description: "Only routes to models allowing text distillation.",
        options: [
          { value: "", label: "default" },
          { value: "true", label: "true" },
          { value: "false", label: "false" },
        ],
      },
      {
        key: "provider.only",
        label: "provider.only",
        placeholder: '["openai"]',
        description: "Only allows these provider slugs.",
      },
      {
        key: "provider.ignore",
        label: "provider.ignore",
        placeholder: '["deepinfra"]',
        description: "Skips these provider slugs.",
      },
      {
        key: "provider.quantizations",
        label: "provider.quantizations",
        placeholder: '["fp8"]',
        description: "Filters providers by quantization level.",
      },
      {
        key: "provider.sort",
        label: "provider.sort",
        placeholder: "latency",
        description:
          "Sorts providers by price, throughput, latency, or object config.",
      },
      {
        key: "provider.preferred_min_throughput",
        label: "provider.preferred_min_throughput",
        placeholder: "50",
        description: "Prefers providers above this tokens-per-second floor.",
      },
      {
        key: "provider.preferred_max_latency",
        label: "provider.preferred_max_latency",
        placeholder: "2",
        description: "Prefers providers below this latency in seconds.",
      },
      {
        key: "provider.max_price.prompt",
        label: "provider.max_price.prompt",
        type: "number",
        placeholder: "",
        description: "Maximum prompt price you will accept.",
      },
      {
        key: "provider.max_price.completion",
        label: "provider.max_price.completion",
        type: "number",
        placeholder: "",
        description: "Maximum completion price you will accept.",
      },
      {
        key: "provider.max_price.request",
        label: "provider.max_price.request",
        type: "number",
        placeholder: "",
        description: "Maximum per-request price you will accept.",
      },
      {
        key: "provider.max_price.image",
        label: "provider.max_price.image",
        type: "number",
        placeholder: "",
        description: "Maximum per-image price you will accept.",
      },
    ],
  },
];

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function attr(value: unknown): string {
  return esc(String(value ?? ""));
}

type RestorableControl =
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

interface ControlSnapshot {
  selector: string;
  index: number;
  value: string;
  checked?: boolean;
}

interface FocusSnapshot extends ControlSnapshot {
  selectionStart: number | null;
  selectionEnd: number | null;
}

function isRestorableControl(element: Element): element is RestorableControl {
  if (
    element instanceof HTMLInputElement &&
    ![
      "button",
      "checkbox",
      "file",
      "hidden",
      "image",
      "radio",
      "reset",
      "submit",
    ].includes(element.type)
  )
    return true;
  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

function controlSelector(control: RestorableControl): string | null {
  if (control instanceof HTMLTextAreaElement && control.dataset.editTextarea)
    return `[data-edit-textarea="${CSS.escape(control.dataset.editTextarea)}"]`;
  if (control.matches(".composer textarea[name='message']"))
    return `.composer textarea[name="message"]`;
  const dataAttributes = [
    "composerAgent",
    "openThinkingDefault",
    "settingApiKey",
    "settingFont",
    "syncRepository",
    "syncBranch",
    "syncPath",
    "syncAutosync",
    "syncToken",
  ] as const;
  for (const key of dataAttributes) {
    if (key in control.dataset) {
      return `[data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;
    }
  }
  const name = control.getAttribute("name");
  if (!name) return null;
  const tag = control.tagName.toLowerCase();
  if (control.closest("[data-agent-form]"))
    return `[data-agent-form] ${tag}[name="${CSS.escape(name)}"]`;
  const dialog = control.closest<HTMLDialogElement>("dialog[id]");
  if (dialog)
    return `#${CSS.escape(dialog.id)} ${tag}[name="${CSS.escape(name)}"]`;
  if (control.closest(".right-sidebar"))
    return `.right-sidebar ${tag}[name="${CSS.escape(name)}"]`;
  return `${tag}[name="${CSS.escape(name)}"]`;
}

function snapshotControl(
  app: HTMLElement,
  control: RestorableControl,
): ControlSnapshot | null {
  const selector = controlSelector(control);
  if (!selector) return null;
  const controls = Array.from(
    app.querySelectorAll<RestorableControl>(selector),
  );
  const index = Math.max(0, controls.indexOf(control));
  return {
    selector,
    index,
    value: control.value,
    checked: control instanceof HTMLInputElement ? control.checked : undefined,
  };
}

function captureControlSnapshots(app: HTMLElement): ControlSnapshot[] {
  return Array.from(app.querySelectorAll("input, textarea, select"))
    .filter(isRestorableControl)
    .map((control) => snapshotControl(app, control))
    .filter((snapshot): snapshot is ControlSnapshot => !!snapshot);
}

function captureFocusSnapshot(app: HTMLElement): FocusSnapshot | null {
  const active = document.activeElement;
  if (!active || !app.contains(active) || !isRestorableControl(active))
    return null;
  const snapshot = snapshotControl(app, active);
  if (!snapshot) return null;
  return {
    ...snapshot,
    selectionStart: "selectionStart" in active ? active.selectionStart : null,
    selectionEnd: "selectionEnd" in active ? active.selectionEnd : null,
  };
}

function findControl(
  app: HTMLElement,
  snapshot: ControlSnapshot,
): RestorableControl | null {
  return (
    app.querySelectorAll<RestorableControl>(snapshot.selector)[
      snapshot.index
    ] ?? null
  );
}

function restoreControlSnapshots(
  app: HTMLElement,
  snapshots: ControlSnapshot[],
): void {
  for (const snapshot of snapshots) {
    const control = findControl(app, snapshot);
    if (!control) continue;
    control.value = snapshot.value;
    if (control instanceof HTMLInputElement && snapshot.checked !== undefined)
      control.checked = snapshot.checked;
  }
}

function restoreFocusSnapshot(
  app: HTMLElement,
  snapshot: FocusSnapshot | null,
): void {
  if (!snapshot) return;
  const control = findControl(app, snapshot);
  if (!control) return;
  control.focus({ preventScroll: true });
  if (
    "setSelectionRange" in control &&
    snapshot.selectionStart !== null &&
    snapshot.selectionEnd !== null
  ) {
    control.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
  }
}

function activeElementIsAuxiliaryInput(app: HTMLElement): boolean {
  const active = document.activeElement;
  return !!(
    active &&
    app.contains(active) &&
    isRestorableControl(active) &&
    (active.closest(".right-sidebar") || active.closest("dialog"))
  );
}

export function render(app: HTMLElement, state: AppState): void {
  const settings = currentSettings();
  const previousSessionId = app.dataset.renderSessionId ?? "";
  const nextSessionId = state.sessionId ?? "";
  const rightSidebarCollapsed =
    "rightSidebarCollapsed" in app.dataset
      ? app.dataset.rightSidebarCollapsed !== "false"
      : defaultRightSidebarCollapsed(settings.rightSidebarCollapsed);
  const rightSidebarTab = app.dataset.rightSidebarTab ?? "sessions";
  const previousConversation = app.querySelector<HTMLElement>(".conversation");
  const previousScrollTop = previousConversation?.scrollTop ?? 0;
  const previousConversationNearBottom = previousConversation
    ? isNearBottom(previousConversation)
    : true;
  const previousRightSidebar = app.querySelector<HTMLElement>(".right-sidebar");
  const previousRightSidebarScrollTop = previousRightSidebar?.scrollTop ?? 0;
  const openDialog = app.querySelector<HTMLDialogElement>("dialog[open]");
  const openDialogId = openDialog?.id;
  const openDialogScrollTop = openDialog?.scrollTop ?? 0;
  const focusSnapshot = captureFocusSnapshot(app);
  const controlSnapshots = captureControlSnapshots(app);
  const focusedInAuxiliaryInput = activeElementIsAuxiliaryInput(app);
  const sessionChanged = previousSessionId !== nextSessionId;
  const preserveScrollMessageId = app.dataset.preserveScrollMessageId;
  const preserveScrollViewportY = Number(app.dataset.preserveScrollViewportY);
  const preserveScrollOffsetY = Number(app.dataset.preserveScrollOffsetY);
  const shouldAutoScroll =
    !preserveScrollMessageId &&
    (!previousConversation ||
      sessionChanged ||
      (app.dataset.autoscroll !== "false" &&
        previousConversationNearBottom &&
        !focusedInAuxiliaryInput));
  const thinkingOpenByMessage = new Map(
    Array.from(
      app.querySelectorAll<HTMLElement>("[data-message-body]"),
    ).flatMap((body) => {
      const id = body.dataset.messageBody;
      const block = body.querySelector<HTMLDetailsElement>(
        "[data-thinking-block]",
      );
      return id && block ? [[id, block.open] as const] : [];
    }),
  );

  app.innerHTML = `
    <div class="app-shell ${rightSidebarCollapsed ? "right-sidebar-collapsed" : ""}">
      <main class="chat-panel">
        <header class="chat-header">
          <div class="header-left-actions"><div class="app-mark" aria-label="tachyon">tachyon</div></div>
          <div class="header-actions"><button class="icon-button borderless-icon" data-toggle-right-sidebar aria-label="${rightSidebarCollapsed ? "expand right sidebar" : "collapse right sidebar"}" title="${rightSidebarCollapsed ? "expand right sidebar" : "collapse right sidebar"}"><span class="right-sidebar-toggle-icon ${rightSidebarCollapsed ? "collapsed" : ""}" data-right-sidebar-toggle-icon>&lt;|</span></button></div>
        </header>
        <div class="notices">${state.errors.map((e, index) => `<p class="error" data-dismiss-notice="error:${index}" title="Dismiss">${esc(e)}</p>`).join("")}${state.info.map((e, index) => `<p class="info" data-dismiss-notice="info:${index}" title="Dismiss">${esc(e)}</p>`).join("")}</div>
        <section class="conversation">
          ${state.session ? renderMessages(state, app, thinkingOpenByMessage) : renderBlankState()}
          ${renderComposerControls(state)}
          <div class="scroll-anchor" data-scroll-anchor></div>
        </section>
        ${renderComposerInput(state, app)}
      </main>

      <button class="mobile-sidebar-backdrop" type="button" data-toggle-right-sidebar aria-label="close sidebar" ${rightSidebarCollapsed ? "hidden" : ""}></button>
      <aside class="right-sidebar ${rightSidebarCollapsed ? "collapsed" : ""}" aria-label="right sidebar" aria-hidden="${rightSidebarCollapsed}" ${rightSidebarCollapsed ? "inert" : ""}>
        ${renderRightSidebar(settings, state, app, rightSidebarTab)}
      </aside>
    </div>`;

  app.dataset.renderSessionId = nextSessionId;
  app.dataset.rightSidebarCollapsed = String(rightSidebarCollapsed);
  if (sessionChanged || app.dataset.autoscroll === undefined) {
    app.dataset.autoscroll = "true";
  }

  if (!sessionChanged) restoreControlSnapshots(app, controlSnapshots);

  const rightSidebar = app.querySelector<HTMLElement>(".right-sidebar");
  if (rightSidebar) rightSidebar.scrollTop = previousRightSidebarScrollTop;

  const conversation = app.querySelector<HTMLElement>(".conversation");
  if (conversation) {
    bindScrollIntent(app, conversation);
    requestAnimationFrame(() => {
      if (preserveScrollMessageId) {
        conversation.scrollTop = previousScrollTop;
        const message = app.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(preserveScrollMessageId)}"]`,
        );
        if (
          message &&
          Number.isFinite(preserveScrollViewportY) &&
          Number.isFinite(preserveScrollOffsetY)
        ) {
          const desiredTop = preserveScrollViewportY - preserveScrollOffsetY;
          conversation.scrollTop +=
            message.getBoundingClientRect().top - desiredTop;
        }
        delete app.dataset.preserveScrollMessageId;
        delete app.dataset.preserveScrollViewportY;
        delete app.dataset.preserveScrollOffsetY;
      } else if (shouldAutoScroll) {
        scrollToAnchor(app);
        requestAnimationFrame(() => scrollToAnchor(app));
      } else {
        conversation.scrollTop = previousScrollTop;
      }
      if (!sessionChanged) restoreFocusSnapshot(app, focusSnapshot);
    });
  }

  if (openDialogId) {
    const dialog = document.getElementById(
      openDialogId,
    ) as HTMLDialogElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    if (dialog) dialog.scrollTop = openDialogScrollTop;
  }
}

function defaultRightSidebarCollapsed(savedCollapsed: boolean): boolean {
  return window.matchMedia("(max-width: 800px)").matches || savedCollapsed;
}

function bindScrollIntent(app: HTMLElement, conversation: HTMLElement): void {
  let pointerScroll = false;
  const detach = () => {
    app.dataset.autoscroll = "false";
    app.dataset.lastUserScrollAt = String(Date.now());
  };
  conversation.addEventListener(
    "wheel",
    (event) => {
      if (event.deltaY < 0) detach();
    },
    { passive: true },
  );
  conversation.addEventListener("scrollend", () => {
    if (isNearBottom(conversation) && !hasRecentUserScroll(app)) {
      app.dataset.autoscroll = "true";
    }
  });
  conversation.addEventListener("pointerdown", () => {
    pointerScroll = true;
  });
  conversation.addEventListener("pointerup", () => {
    pointerScroll = false;
    if (isNearBottom(conversation)) app.dataset.autoscroll = "true";
  });
  conversation.addEventListener("pointercancel", () => {
    pointerScroll = false;
  });
  conversation.addEventListener(
    "touchmove",
    () => {
      detach();
    },
    { passive: true },
  );
  conversation.addEventListener("scroll", () => {
    if (isNearBottom(conversation) && !hasRecentUserScroll(app)) {
      app.dataset.autoscroll = "true";
    } else if (pointerScroll) detach();
  });
  conversation.addEventListener("keydown", (event) => {
    if (["ArrowUp", "PageUp", "Home"].includes(event.key)) detach();
  });
}

function hasRecentUserScroll(app: HTMLElement): boolean {
  return Date.now() - Number(app.dataset.lastUserScrollAt ?? 0) < 750;
}

function scrollToAnchor(app: HTMLElement): void {
  app
    .querySelector<HTMLElement>("[data-scroll-anchor]")
    ?.scrollIntoView({ block: "end", behavior: "instant" });
}

function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 64;
}

function renderBlankState(): string {
  return `<div class="blank-state" data-testid="blank"></div>`;
}

function renderMessages(
  state: AppState,
  app: HTMLElement,
  thinkingOpenByMessage: Map<string, boolean>,
): string {
  const editingId = app.dataset.editingMessageId ?? "";
  const editingDraft = app.dataset.editingDraft;
  return `<ol class="messages">${state.visible
    .map((m) => {
      const sibs = siblings(state.messages, m);
      const idx = sibs.findIndex((s) => s.id === m.id);
      const prevControl =
        idx > 0
          ? `<button class="icon-button borderless-icon branch-arrow" data-branch-prev="${m.id}" aria-label="Previous variant" title="Previous variant">&lt;</button>`
          : `<span class="branch-arrow branch-arrow-placeholder" aria-hidden="true">&lt;</span>`;
      const nextControl =
        idx < sibs.length - 1
          ? `<button class="icon-button borderless-icon branch-arrow" data-branch-next="${m.id}" aria-label="Next variant" title="Next variant">&gt;</button>`
          : `<span class="branch-arrow branch-arrow-placeholder" aria-hidden="true">&gt;</span>`;
      const display = normalizeMessageForDisplay(m);
      const isStreamingAssistant = m.role === "assistant" && !m.finalized;
      const branchControls =
        sibs.length > 1 && !isStreamingAssistant
          ? `<div class="branch-controls">${prevControl}<span class="branch-count">${idx + 1}/${sibs.length}</span>${nextControl}</div>`
          : "";
      const isEditing = editingId === m.id;
      const content = m.deletedAt
        ? `<div class="deleted-message">deleted message</div>`
        : isEditing
          ? `<textarea class="message-edit-textarea" data-edit-textarea="${m.id}" style="height: ${Number(app.dataset.editingHeight ?? 0) || 128}px" aria-label="Edit message">${esc(editingDraft ?? m.content)}</textarea>`
          : `<div class="message-body" data-message-body="${m.id}">${renderDisplayContent(display.thinkingText, display.visibleContent, thinkingOpenByMessage.get(m.id) ?? currentSettings().openThinkingByDefault)}</div>`;
      const controls = m.deletedAt
        ? `<div class="message-actions"><button class="icon-button borderless-icon restore-button" data-restore="${m.id}" aria-label="Restore deleted message" title="Restore deleted message">restore deleted message</button></div>`
        : isEditing
          ? `<div class="message-actions"><button class="icon-button borderless-icon" data-save-edit="${m.id}" aria-label="Save" title="Save">save</button><button class="icon-button borderless-icon" data-save-resend="${m.id}" aria-label="Save and resend" title="Save and resend">save &amp; resend</button><button class="icon-button borderless-icon" data-cancel-edit aria-label="Cancel" title="Cancel">cancel</button></div>`
          : `<div class="message-actions"><button class="icon-button borderless-icon" data-copy="${m.id}" aria-label="Copy" title="Copy">copy</button><button class="icon-button borderless-icon" data-edit="${m.id}" aria-label="Edit" title="Edit">edit</button><button class="icon-button borderless-icon" data-fork="${m.id}" aria-label="Fork" title="Fork">fork</button><button class="icon-button borderless-icon" data-delete="${m.id}" aria-label="Delete" title="Delete">delete</button>${m.role === "assistant" ? `<button class="icon-button borderless-icon" data-regenerate="${m.id}" aria-label="Redo" title="Redo">redo</button>` : ""}</div>`;
      return `<li data-message-id="${m.id}" class="message ${m.role}${m.deletedAt ? " deleted" : ""}"><div class="message-card"><div class="message-meta"><strong>${m.role === "assistant" ? "assistant" : "user"}</strong></div>${content}${isStreamingAssistant ? "" : `<div class="message-controls">${branchControls}${controls}</div>`}</div></li>`;
    })
    .join("")}</ol>`;
}

export function renderDisplayContent(
  thinkingText: string,
  visibleContent: string,
  openThinking = false,
): string {
  return `${thinkingText ? `<details class="thinking-block" data-thinking-block ${openThinking ? "open" : ""}><summary>thinking</summary><pre data-thinking-content>${esc(thinkingText)}</pre></details>` : ""}<pre data-message-content>${esc(visibleContent)}</pre>`;
}

function renderBackToTopButton(className: string): string {
  return `<button class="left-text-button ${className}" type="button" data-back-to-top aria-label="Back to top" title="Back to top">back to top</button>`;
}

function renderComposerControls(state: AppState): string {
  const settings = currentSettings();
  const hasVisibleMessages = state.visible.some((m) => !m.deletedAt);
  const newChatButton = state.session
    ? `<button class="left-text-button" type="button" data-action="new-session" aria-label="new chat" title="new chat">new chat</button>`
    : "";
  const copyButton = hasVisibleMessages
    ? `<button class="left-text-button" type="button" data-copy-conversation aria-label="Copy conversation" title="Copy conversation">copy conversation</button>`
    : "";
  const mobileBackToTopButton = hasVisibleMessages
    ? renderBackToTopButton("mobile-only")
    : "";
  const agentSelect = `<label class="composer-agent-label">agent: <select data-composer-agent aria-label="agent">${state.agents
    .filter((a) => !a.archived)
    .map(
      (a) =>
        `<option value="${a.id}" ${settings.selectedAgentId === a.id ? "selected" : ""}>${esc(a.name)}</option>`,
    )
    .join("")}</select></label>`;
  const thinkingDefault = `<label class="composer-agent-label">thinking blocks: <select data-open-thinking-default aria-label="thinking blocks"><option value="open" ${settings.openThinkingByDefault ? "selected" : ""}>open</option><option value="closed" ${settings.openThinkingByDefault ? "" : "selected"}>closed</option></select></label>`;
  return `<div class="composer-context composer-flow-controls"><div class="composer-selects">${agentSelect}${thinkingDefault}</div><div class="composer-actions">${newChatButton}${copyButton}${mobileBackToTopButton}</div></div>`;
}

function renderComposerInput(state: AppState, app: HTMLElement): string {
  const abort = viewedHasInflight();
  const draftKey = composerDraftKey(state.sessionId);
  const draft =
    app.dataset.composerDraftKey === draftKey
      ? (app.dataset.composerDraft ?? "")
      : readComposerDraft(state.sessionId);
  const desktopBackToTopButton = state.visible.some((m) => !m.deletedAt)
    ? `<div class="composer-bottom-actions">${renderBackToTopButton("desktop-only")}</div>`
    : "";
  return `<form class="composer" data-compose><div class="composer-box"><textarea name="message" rows="1" enterkeyhint="send" placeholder="Message (empty for assistant-only)">${esc(draft)}</textarea><button class="icon-button send-button" type="submit" aria-label="${abort ? "Abort" : "Send"}" title="${abort ? "Abort" : "Send"}">${abort ? "halt" : "send"}</button></div>${desktopBackToTopButton}</form>`;
}

function renderRightSidebar(
  settings: {
    openRouterApiKey: string;
    selectedAgentId: string | null;
    fontFamily: string;
  },
  state: AppState,
  app: HTMLElement,
  activeTab: string,
): string {
  const tab = ["sessions", "agents", "data", "settings"].includes(activeTab)
    ? activeTab
    : "sessions";
  return `<div class="right-sidebar-content"><div class="mobile-sidebar-header"><span class="app-mark">menu</span><button class="icon-button borderless-icon" type="button" data-toggle-right-sidebar aria-label="close sidebar" title="close sidebar">close</button></div><div class="right-tabs"><button class="left-text-button right-tab ${tab === "sessions" ? "active" : ""}" data-right-tab="sessions">sessions</button><button class="left-text-button right-tab ${tab === "agents" ? "active" : ""}" data-right-tab="agents">agents</button><button class="left-text-button right-tab ${tab === "data" ? "active" : ""}" data-right-tab="data">data</button><button class="left-text-button right-tab ${tab === "settings" ? "active" : ""}" data-right-tab="settings">settings</button></div>${tab === "sessions" ? renderSessionsPanel(state) : tab === "settings" ? renderSettingsPanel(settings) : tab === "agents" ? renderAgentsPanel(state, app) : renderDataPanel(app)}</div>`;
}

function renderSessionsPanel(state: AppState): string {
  return `<section class="right-panel"><nav class="left-session-nav"><ul>${state.sessions.map((s) => `<li class="session-row"><button class="session-link ${state.session?.id === s.id ? "active" : ""}" data-open-session="${s.id}" title="open chat">${esc(s.title)}</button><button class="left-text-button" data-archive-session="${s.id}" aria-label="archive chat" title="archive chat">archive</button></li>`).join("")}</ul><details class="archive-panel"><summary>archived</summary><ul>${state.archivedSessions.map((s) => `<li class="session-row"><button class="session-link" data-open-session="${s.id}" title="open archived chat">${esc(s.title)}</button><button class="left-text-button" data-unarchive-session="${s.id}" aria-label="restore chat" title="restore chat">restore</button></li>`).join("")}</ul></details></nav></section>`;
}

function renderSettingsPanel(settings: {
  openRouterApiKey: string;
  selectedAgentId: string | null;
  fontFamily: string;
}): string {
  const sync = getGithubSyncState();
  const tokenUrl =
    "https://github.com/settings/personal-access-tokens/new?name=Tachyon+Sync&description=Sync+Tachyon+data&contents=write&expires_in=365";
  const fontOptions = FONT_OPTIONS.map(
    (option) => `
      <option
        value="${attr(option.value)}"
        style="font-family: ${attr(option.value)}"
        ${settings.fontFamily === option.value ? "selected" : ""}
      >${esc(option.label)}</option>
    `,
  ).join("");

  return `
    <section class="right-panel">
      <label>
        openrouter api key
        <input data-setting-api-key type="password" value="${esc(settings.openRouterApiKey)}" placeholder="sk-or-...">
      </label>

      <label>
        font
        <select data-setting-font>${fontOptions}</select>
      </label>

      <div class="settings-group">
        <p><strong>github</strong></p>

        <label>
          autosync
          <select data-sync-autosync>
            <option value="off" ${sync.config.autosync === "off" ? "selected" : ""}>off</option>
            <option value="30s" ${sync.config.autosync === "30s" ? "selected" : ""}>every 30s</option>
          </select>
          <span class="field-help">Whether to enable remote sync on a 30 second timer.</span>
        </label>

        <label>
          <a href="${attr(tokenUrl)}" target="_blank" rel="noreferrer">token</a>
          <input data-sync-token type="password" value="${attr(sync.config.token)}">
          <span class="field-help">Fine-grained GitHub token with Contents read/write. Required for autosync.</span>
        </label>

        <label>
          repository
          <input data-sync-repository value="${attr(sync.config.repository)}" placeholder="owner/repo">
          <span class="field-help">Existing GitHub repository to store the sync file. Required for autosync.</span>
        </label>

        <label>
          branch
          <input data-sync-branch value="${attr(sync.config.branch)}" placeholder="main">
          <span class="field-help">Leave blank to use the repository default branch.</span>
        </label>

        <label>
          path
          <input data-sync-path value="${attr(sync.config.path)}" placeholder="tachyon/export.json">
          <span class="field-help">Leave blank to use tachyon-sync.json in the repo root.</span>
        </label>
      </div>

      <div class="settings-actions">
        <button class="left-text-button save-settings-button" data-save-settings>save</button>
      </div>

      <p class="settings-version">version ${esc(APP_COMMIT.slice(0, 7))}</p>
    </section>
  `;
}

function renderDataPanel(app: HTMLElement): string {
  const sync = getGithubSyncState();
  const review = parseImportReview(app);
  const resolutions = parseImportResolutions(app);
  const reviewSource = app.dataset.importReviewSource;
  const unresolvedConflicts = countUnresolvedConflicts(review, resolutions);
  const summary =
    review?.valid && review.summary
      ? renderImportSummary(review, resolutions)
      : "";
  const error =
    review && !review.valid
      ? `<div class="import-review"><p><strong>cannot import this file</strong></p><p class="error">${esc(review.error ?? "Invalid export file.")}</p></div>`
      : "";
  const syncReview = reviewSource === "sync";
  const actions = review?.valid
    ? `
      <section class="data-row">
        <p class="field-help">Apply safe incoming changes and your conflict decisions.${syncReview ? " Then push the resolved result to GitHub." : ""}${unresolvedConflicts ? ` Choose an action for ${unresolvedConflicts} more conflict${unresolvedConflicts === 1 ? "" : "s"} first.` : ""}</p>
        <button class="left-text-button" data-import-merge ${unresolvedConflicts ? "disabled" : ""}>${esc(importActionLabel(app, syncReview))}</button>
      </section>

      <section class="data-row">
        <p class="field-help">Delete local records not in the incoming file, then load the incoming file exactly.</p>
        <button class="left-text-button" data-import-replace>${esc(app.dataset.importActionStatus === "replacing" ? "replacing..." : "replace local data")}</button>
      </section>

      ${
        syncReview
          ? `
            <section class="data-row">
              <p class="field-help">Overwrite remote with local data.</p>
              <button class="left-text-button" data-sync-overwrite>overwrite</button>
            </section>
          `
          : ""
      }
    `
    : "";
  const conflict =
    sync.status === "conflict" ? renderSyncConflictSummary() : "";
  const syncStatus = sync.error ? `${sync.status}: ${sync.error}` : sync.status;
  return `
    <section class="right-panel">
      <section class="data-row sync-panel">
        <div>
          <p><strong>github sync</strong></p>
          <p class="field-help">status: ${esc(syncStatus)}</p>
          <p class="field-help">last sync: ${esc(formatTime(sync.lastSync))}</p>
          <p class="field-help">last pull: ${esc(formatTime(sync.lastPull))}</p>
          <p class="field-help">last push: ${esc(formatTime(sync.lastPush))}</p>
          ${conflict}
        </div>
        <div class="data-row-actions">
          <button class="left-text-button" data-sync-now>${esc(app.dataset.importActionStatus === "syncing" ? "syncing..." : "sync")}</button>
          <button class="left-text-button" data-sync-reset-remote>${esc(app.dataset.importActionStatus === "resetting-remote" ? "resetting remote..." : "reset remote to local")}</button>
        </div>
      </section>

      <section class="data-row">
        <p class="field-help">Download a backup of all chats and agents.</p>
        <button class="left-text-button" data-action="export">export data</button>
      </section>

      <section class="data-row">
        <p class="field-help">Upload a Tachyon backup. Tachyon recalculates this review from current local data before every merge.</p>
        <label class="left-text-button import-button">
          choose file
          <input data-action="import" type="file" accept="application/json">
        </label>
      </section>

      ${sync.status === "conflict" && !review ? `<div class="import-review"><p><strong>sync conflict</strong></p><p class="field-help">Conflict details are derived on demand from current local data and the pending remote file.</p><button class="left-text-button" data-refresh-import-review>recalculate review</button></div>` : ""}
      ${error}
      ${summary}
      ${actions}
    </section>
  `;
}

function formatTime(value: number | null): string {
  return value ? new Date(value).toLocaleString() : "never";
}

function importActionLabel(app: HTMLElement, syncReview: boolean): string {
  const status = app.dataset.importActionStatus;
  if (status === "merging")
    return syncReview ? "merging and pushing..." : "merging...";
  if (status === "merged") return syncReview ? "merged and pushed!" : "merged!";
  return syncReview ? "apply decisions and push" : "apply selected merge";
}

function renderSyncConflictSummary(): string {
  return `<div class="sync-conflicts"><p><strong>conflicts need review</strong></p><p class="field-help">Tachyon recalculates conflict details from the remote file and current local data before applying decisions.</p></div>`;
}

interface ParsedImportReview {
  valid: boolean;
  error?: string;
  exportedAt?: number;
  summary?: Record<
    string,
    {
      added: number;
      changed: number;
      unchanged: number;
      removedOnReplace: number;
      quarantined: number;
    }
  >;
  quarantineReasons?: string[];
  records?: Record<
    string,
    Array<{
      store: string;
      id: string;
      status: string;
      label: string;
      updatedAt?: number;
      reason?: string;
      fields: Array<{
        field: string;
        local: string;
        incoming: string;
        text: boolean;
      }>;
    }>
  >;
}

function parseImportReview(app: HTMLElement): ParsedImportReview | null {
  if (!app.dataset.importReview) return null;
  try {
    return JSON.parse(app.dataset.importReview) as ParsedImportReview;
  } catch {
    return null;
  }
}

function parseImportResolutions(app: HTMLElement): Record<string, string> {
  if (!app.dataset.importResolutions) return {};
  try {
    const parsed = JSON.parse(app.dataset.importResolutions) as Record<
      string,
      string
    >;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) =>
        ["local", "incoming", "skip"].includes(value),
      ),
    );
  } catch {
    return {};
  }
}

function countUnresolvedConflicts(
  review: ParsedImportReview | null,
  resolutions: Record<string, string>,
): number {
  if (!review?.records) return 0;
  return Object.values(review.records)
    .flat()
    .filter(
      (record) =>
        record.status === "conflict" &&
        !resolutions[`${record.store}:${record.id}`],
    ).length;
}

function renderImportSummary(
  review: ParsedImportReview,
  resolutions: Record<string, string>,
): string {
  const rows = ["sessions", "messages", "agents"]
    .map((key) => {
      const bucket = review.summary?.[key];
      if (!bucket) return "";
      return `<tr><th scope="row">${esc(key)}</th><td>${bucket.added}</td><td>${bucket.changed}</td><td>${bucket.removedOnReplace}</td><td>${bucket.quarantined}</td></tr>`;
    })
    .join("");
  const unresolvedConflicts = countUnresolvedConflicts(review, resolutions);
  const reasons = review.quarantineReasons?.length
    ? `<details class="archive-panel" ${unresolvedConflicts ? "open" : ""}><summary>${unresolvedConflicts ? "needs decisions" : "resolved conflict reasons"}</summary><ul>${review.quarantineReasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul></details>`
    : "";
  const exportedAt = review.exportedAt
    ? `<p class="import-exported-at">file exported at: ${esc(new Date(review.exportedAt).toLocaleString())}</p>`
    : "";
  const details = renderImportRecordDiffs(review, resolutions);
  return `<div class="import-review"><p><strong>import preview</strong></p>${exportedAt}<table class="import-diff-table"><thead><tr><th></th><th>add</th><th>update</th><th>delete on replace*</th><th>needs decision</th></tr></thead><tbody>${rows}</tbody></table><div class="field-help import-definitions"><p>add: incoming records that do not exist locally.</p><p>update: incoming records Tachyon can merge safely.</p><p>delete on replace*: local records missing from the incoming file; only deleted by replace local data.</p><p>needs decision: conflicting records. Choose keep local, use incoming, or skip before applying the merge.</p></div>${details}${reasons}</div>`;
}

function renderImportRecordDiffs(
  review: ParsedImportReview,
  resolutions: Record<string, string>,
): string {
  if (!review.records) return "";
  return ["sessions", "messages", "agents"]
    .map((key) => {
      const records = (review.records?.[key] ?? []).filter(
        (record) => record.status !== "unchanged",
      );
      if (!records.length) return "";
      return `<details class="archive-panel import-records" ${records.some((record) => record.status === "conflict") ? "open" : ""}><summary>${esc(key)} changes</summary>${records.map((record) => renderImportRecordDiff(record, resolutions)).join("")}</details>`;
    })
    .join("");
}

function importStatusLabel(status: string): string {
  if (status === "add") return "will add";
  if (status === "update") return "will update";
  if (status === "delete on replace") return "replace would delete";
  if (status === "conflict") return "needs decision";
  return status;
}

function renderImportRecordDiff(
  record: NonNullable<ParsedImportReview["records"]>[string][number],
  resolutions: Record<string, string>,
): string {
  const key = `${record.store}:${record.id}`;
  const resolution = resolutions[key];
  const fieldRows = record.fields.length
    ? record.fields.map((field) => renderImportFieldDiff(field)).join("")
    : `<p class="field-help">no field changes</p>`;
  const canUseIncoming = record.reason === "Conflicting stable ID record";
  const actions =
    record.status === "conflict"
      ? `<div class="import-conflict-actions" data-conflict-key="${attr(key)}">
          <button type="button" class="left-text-button ${resolution === "local" ? "selected" : ""}" data-import-resolution="local" data-import-conflict="${attr(key)}">keep local</button>
          ${canUseIncoming ? `<button type="button" class="left-text-button ${resolution === "incoming" ? "selected" : ""}" data-import-resolution="incoming" data-import-conflict="${attr(key)}">use incoming</button>` : ""}
          <button type="button" class="left-text-button ${resolution === "skip" ? "selected" : ""}" data-import-resolution="skip" data-import-conflict="${attr(key)}">skip</button>
        </div>`
      : "";
  const resolved = resolution
    ? `<p class="field-help">selected: ${esc(resolution === "local" ? "keep local" : resolution === "incoming" ? "use incoming" : "skip")}</p>`
    : "";
  const reason = record.reason
    ? `<p class="${resolution ? "field-help" : "error"}">reason: ${esc(record.reason)}</p>`
    : "";
  return `<details class="import-record ${record.status === "conflict" && !resolution ? "import-record-conflict" : ""}" ${record.status === "conflict" ? "open" : ""}><summary><span>${esc(resolution ? "resolved" : importStatusLabel(record.status))}</span> <strong>${esc(record.label)}</strong></summary><p class="field-help">id: ${esc(record.id)}${record.updatedAt ? ` · updated: ${esc(formatTime(record.updatedAt))}` : ""}</p>${reason}${fieldRows}${actions}${resolved}</details>`;
}

function renderImportFieldDiff(field: {
  field: string;
  local: string;
  incoming: string;
  text: boolean;
}): string {
  if (field.text)
    return `<details class="import-field-diff"><summary>${esc(field.field)}</summary><pre><span class="diff-local">local</span>\n${esc(field.local)}\n\n<span class="diff-incoming">incoming</span>\n${esc(field.incoming)}</pre></details>`;
  return `<table class="import-field-table"><tbody><tr><th scope="row">${esc(field.field)}</th><td><span class="field-help">local</span><br>${esc(field.local)}</td><td><span class="field-help">incoming</span><br>${esc(field.incoming)}</td></tr></tbody></table>`;
}

function renderAgentsPanel(state: AppState, app: HTMLElement): string {
  const activeAgents = state.agents.filter((a) => !a.archived);
  const archivedAgents = state.agents.filter((a) => a.archived);
  return `<section class="right-panel"><ul class="agent-list sidebar-agent-list">${activeAgents.map((a) => renderAgentRow(a)).join("")}</ul><details class="archive-panel"><summary>archived</summary><ul class="agent-list sidebar-agent-list">${archivedAgents.map((a) => renderAgentRow(a)).join("")}</ul></details><button class="left-text-button full-width-text-button" data-agent-create>create new</button>${renderAgentForm(state, app)}</section>`;
}

function renderAgentForm(state: AppState, app: HTMLElement): string {
  const mode = app.dataset.agentFormMode;
  if (!mode) return "";
  const agent =
    mode === "edit"
      ? state.agents.find((a) => a.id === app.dataset.agentFormId)
      : undefined;
  const draftAgent: AgentRecord = agent ?? {
    id: "",
    name: "",
    model: "",
    systemPrompt: "",
    params: {},
    createdAt: 0,
    updatedAt: 0,
    archived: false,
  };
  const status = agent ? `editing: ${esc(agent.name)}` : "creating new agent";
  return `<div class="agent-fields-section"><p class="agent-form-status">${status}</p><form class="agent-form" data-agent-form><input type="hidden" name="id" value="${attr(agent?.id ?? "")}"><label>name<input name="name" value="${attr(agent?.name ?? "")}" placeholder="concise assistant"></label><label>model slug<input name="model" value="${attr(agent?.model ?? "")}" placeholder="openai/gpt-4o-mini"></label><label>system prompt<textarea name="systemPrompt" placeholder="You are concise and practical.">${esc(agent?.systemPrompt ?? "")}</textarea></label>${renderParamFields(draftAgent, agent?.params)}<div class="settings-actions"><button class="left-text-button save-agent-button" aria-label="Save agent" title="Save agent">save</button><button type="button" class="left-text-button" data-agent-form-cancel>cancel</button></div></form></div>`;
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}

function stringifyParam(value: unknown): string {
  if (value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function getParamSectionsForAgent(agent: AgentRecord): ParamSection[] {
  const provider = resolveAgentProvider(agent);
  if (provider === "openrouter") return openRouterParamSections;
  return [];
}

function renderParamFields(
  agent: AgentRecord | null,
  params: Record<string, unknown> = {},
): string {
  if (!agent) return "";
  const paramSections = getParamSectionsForAgent(agent);
  const provider = resolveAgentProvider(agent);
  const commonKeys = new Set(
    paramSections.flatMap((section) =>
      section.fields.map((field) => field.key.split(".")[0]),
    ),
  );
  const extraRows = Object.entries(params)
    .filter(([key]) => !commonKeys.has(key))
    .map(
      ([key, value]) =>
        `<div class="extra-param-row"><input name="extraParamKey" placeholder="key" value="${attr(key)}"><input name="extraParamValue" placeholder="value or JSON" value="${attr(stringifyParam(value))}"><button class="icon-button" type="button" aria-label="Remove field" title="Remove field">×</button></div>`,
    )
    .join("");
  const renderedSections =
    provider === "openrouter"
      ? paramSections
          .map(
            (section) =>
              `<details class="param-section"><summary>${esc(section.title)}</summary><div class="param-section-body">${section.fields.map((field) => renderParamField(field, params)).join("")}</div></details>`,
          )
          .join("")
      : "";
  const extraConfig =
    provider === "openrouter"
      ? `<details class="extra-config"><summary>extra config</summary><div class="param-section-body"><p class="field-help">Add advanced OpenRouter request parameters not listed above.</p><div class="extra-param-list" data-extra-param-list>${extraRows}</div><button type="button" class="secondary-button" data-add-param>+ field</button></div></details>`
      : "";
  return `<details class="params-grid"><summary><a href="https://openrouter.ai/docs/api/reference/parameters" target="_blank" rel="noreferrer">OpenRouter params</a></summary>${renderedSections}${extraConfig}</details>`;
}

function renderParamField(
  field: ParamField,
  params: Record<string, unknown>,
): string {
  const value = stringifyParam(readPath(params, field.key));
  const control = field.options
    ? `<select data-param-path="${field.key}" name="param:${field.key}">${field.options.map((option) => `<option value="${attr(option.value)}" ${value === option.value ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select>`
    : `<input data-param-path="${field.key}" name="param:${field.key}" type="${field.type ?? "text"}" step="any" placeholder="${attr(field.placeholder)}" value="${attr(value)}">`;
  return `<label>${field.label}${control}<span class="field-help">${esc(field.description)}</span></label>`;
}

function renderAgentRow(agent: AgentRecord): string {
  const params = esc(JSON.stringify(agent.params));
  return `<li data-agent-id="${agent.id}" data-agent-name="${attr(agent.name)}" data-agent-model="${attr(agent.model)}" data-agent-system-prompt="${attr(agent.systemPrompt)}" data-agent-params="${params}"><div><strong>${esc(agent.name)}</strong><code>${esc(agent.model)}</code></div><div><button class="left-text-button" data-agent-edit="${agent.id}" aria-label="Edit agent" title="Edit agent">edit</button><button class="left-text-button" data-agent-duplicate="${agent.id}" aria-label="Duplicate agent" title="Duplicate agent">duplicate</button><button class="left-text-button" data-agent-archive="${agent.id}" aria-label="${agent.archived ? "Restore agent" : "Archive agent"}" title="${agent.archived ? "Restore agent" : "Archive agent"}">${agent.archived ? "restore" : "archive"}</button></div></li>`;
}
