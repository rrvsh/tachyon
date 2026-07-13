import type { AgentRecord } from "../data/schema";
import type { AppState } from "../app/state";
import { normalizeMessageForDisplay } from "../messages/display";
import { siblings } from "../messages/tree";
import { currentSettings, viewedHasInflight } from "../app/actions";
import { composerDraftKey, readComposerDraft } from "./drafts";
import { FONT_OPTIONS } from "../settings/settings";
import { getGithubSyncState } from "../sync/state";

type ParamField = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  description: string;
  options?: Array<{ value: string; label: string }>;
};

type ParamSection = { title: string; fields: ParamField[] };

const paramSections: ParamSection[] = [
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
  const openDialogId = app.querySelector<HTMLDialogElement>("dialog[open]")?.id;
  const sessionChanged = previousSessionId !== nextSessionId;
  const preserveScrollMessageId = app.dataset.preserveScrollMessageId;
  const preserveScrollViewportY = Number(app.dataset.preserveScrollViewportY);
  const preserveScrollOffsetY = Number(app.dataset.preserveScrollOffsetY);
  const shouldAutoScroll =
    !preserveScrollMessageId &&
    (!previousConversation ||
      sessionChanged ||
      app.dataset.autoscroll !== "false");
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
          <div class="scroll-anchor" data-scroll-anchor></div>
        </section>
        ${renderComposer(state, app)}
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
    });
  }

  if (openDialogId) {
    const dialog = document.getElementById(
      openDialogId,
    ) as HTMLDialogElement | null;
    if (dialog && !dialog.open) dialog.showModal();
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

function renderComposer(state: AppState, app: HTMLElement): string {
  const abort = viewedHasInflight();
  const draftKey = composerDraftKey(state.sessionId);
  const draft =
    app.dataset.composerDraftKey === draftKey
      ? (app.dataset.composerDraft ?? "")
      : readComposerDraft(state.sessionId);
  const settings = currentSettings();
  const newChatButton = state.session
    ? `<button class="left-text-button" type="button" data-action="new-session" aria-label="new chat" title="new chat">new chat</button>`
    : "";
  const copyButton = state.visible.some((m) => !m.deletedAt)
    ? `<button class="left-text-button" type="button" data-copy-conversation aria-label="Copy conversation" title="Copy conversation">copy conversation</button>`
    : "";
  const agentSelect = `<label class="composer-agent-label">agent: <select data-composer-agent aria-label="agent">${state.agents
    .filter((a) => !a.archived)
    .map(
      (a) =>
        `<option value="${a.id}" ${settings.selectedAgentId === a.id ? "selected" : ""}>${esc(a.name)}</option>`,
    )
    .join("")}</select></label>`;
  const thinkingDefault = `<label class="composer-agent-label">thinking blocks: <select data-open-thinking-default aria-label="thinking blocks"><option value="open" ${settings.openThinkingByDefault ? "selected" : ""}>open</option><option value="closed" ${settings.openThinkingByDefault ? "" : "selected"}>closed</option></select></label>`;
  return `<form class="composer" data-compose><div class="composer-context"><div class="composer-selects">${agentSelect}${thinkingDefault}</div><div class="composer-actions">${newChatButton}${copyButton}</div></div><div class="composer-box"><textarea name="message" rows="1" enterkeyhint="send" placeholder="Message (empty for assistant-only)">${esc(draft)}</textarea><button class="icon-button send-button" type="submit" aria-label="${abort ? "Abort" : "Send"}" title="${abort ? "Abort" : "Send"}">${abort ? "halt" : "send"}</button></div></form>`;
}

function renderRightSidebar(
  settings: {
    apiKey: string;
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
  apiKey: string;
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
        <input data-setting-api-key type="password" value="${esc(settings.apiKey)}" placeholder="sk-or-...">
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
    </section>
  `;
}

function renderDataPanel(app: HTMLElement): string {
  const sync = getGithubSyncState();
  const review = parseImportReview(app) ?? sync.pendingImportReview;
  const summary =
    review?.valid && review.summary ? renderImportSummary(review) : "";
  const error =
    review && !review.valid
      ? `<div class="import-review"><p><strong>cannot import this file</strong></p><p class="error">${esc(review.error ?? "Invalid export file.")}</p></div>`
      : "";
  const syncReview = !app.dataset.importReview && !!sync.pendingImportReview;
  const actions = review?.valid
    ? `
      <section class="data-row">
        <p class="field-help">Merge adds/updates safe records and skips conflicts.</p>
        <button class="left-text-button" data-import-merge>merge</button>
      </section>

      <section class="data-row">
        <p class="field-help">Replace deletes local records missing from backup, then loads this backup.</p>
        <button class="left-text-button" data-import-replace>replace</button>
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
  const conflict = sync.conflictSummary
    ? renderSyncConflictSummary(sync.conflictSummary)
    : "";
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
          <button class="left-text-button" data-sync-now>sync</button>
        </div>
      </section>

      <section class="data-row">
        <p class="field-help">Download a backup of all chats and agents.</p>
        <button class="left-text-button" data-action="export">export data</button>
      </section>

      <section class="data-row">
        <p class="field-help">Upload a Tachyon backup.</p>
        <label class="left-text-button import-button">
          choose file
          <input data-action="import" type="file" accept="application/json">
        </label>
      </section>

      ${error}
      ${summary}
      ${actions}
    </section>
  `;
}

function formatTime(value: number | null): string {
  return value ? new Date(value).toLocaleString() : "never";
}

function renderSyncConflictSummary(
  summary: NonNullable<
    ReturnType<typeof getGithubSyncState>["conflictSummary"]
  >,
): string {
  const rows = ["sessions", "messages", "agents"]
    .map(
      (key) =>
        `<p class="field-help">${esc(key)} ${summary[key as keyof typeof summary]?.quarantined ?? 0}</p>`,
    )
    .join("");
  return `<div class="sync-conflicts"><p><strong>conflicts</strong></p>${rows}</div>`;
}

function parseImportReview(app: HTMLElement): {
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
} | null {
  if (!app.dataset.importReview) return null;
  try {
    return JSON.parse(app.dataset.importReview) as {
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
    };
  } catch {
    return null;
  }
}

function renderImportSummary(review: {
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
  exportedAt?: number;
}): string {
  const rows = ["sessions", "messages", "agents"]
    .map((key) => {
      const bucket = review.summary?.[key];
      if (!bucket) return "";
      return `<tr><th scope="row">${esc(key)}</th><td>${bucket.added}</td><td>${bucket.changed}</td><td>${bucket.removedOnReplace}</td><td>${bucket.quarantined}</td></tr>`;
    })
    .join("");
  const reasons = review.quarantineReasons?.length
    ? `<details class="archive-panel" open><summary>quarantine</summary><ul>${review.quarantineReasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul></details>`
    : "";
  const exportedAt = review.exportedAt
    ? `<p class="import-exported-at">file exported at: ${esc(new Date(review.exportedAt).toLocaleString())}</p>`
    : "";
  return `<div class="import-review"><p><strong>import preview</strong></p>${exportedAt}<table class="import-diff-table"><thead><tr><th></th><th>add</th><th>update</th><th>delete on replace*</th><th>conflicts</th></tr></thead><tbody>${rows}</tbody></table><div class="field-help import-definitions"><p>add: new records from backup.</p><p>update: existing records changed by backup.</p><p>delete on replace*: local records missing from backup; deleted only by replace.</p><p>conflicts: unsafe/conflicting records; skipped silently on merge.</p></div>${reasons}</div>`;
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
  const status = agent ? `editing: ${esc(agent.name)}` : "creating new agent";
  return `<div class="agent-fields-section"><p class="agent-form-status">${status}</p><form class="agent-form" data-agent-form><input type="hidden" name="id" value="${attr(agent?.id ?? "")}"><label>name<input name="name" value="${attr(agent?.name ?? "")}" placeholder="concise assistant"></label><label>model slug<input name="model" value="${attr(agent?.model ?? "")}" placeholder="openai/gpt-4o-mini"></label><label>system prompt<textarea name="systemPrompt" placeholder="You are concise and practical.">${esc(agent?.systemPrompt ?? "")}</textarea></label>${renderParamFields(agent?.params)}<div class="settings-actions"><button class="left-text-button save-agent-button" aria-label="Save agent" title="Save agent">save</button><button type="button" class="left-text-button" data-agent-form-cancel>cancel</button></div></form></div>`;
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

function renderParamFields(params: Record<string, unknown> = {}): string {
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
  return `<details class="params-grid"><summary><a href="https://openrouter.ai/docs/api/reference/parameters" target="_blank" rel="noreferrer">params</a></summary>${paramSections
    .map(
      (section) =>
        `<details class="param-section"><summary>${esc(section.title)}</summary><div class="param-section-body">${section.fields.map((field) => renderParamField(field, params)).join("")}</div></details>`,
    )
    .join(
      "",
    )}<details class="extra-config"><summary>extra config</summary><div class="param-section-body"><p class="field-help">Add provider-specific or advanced OpenRouter request parameters not listed above.</p><div class="extra-param-list" data-extra-param-list>${extraRows}</div><button type="button" class="secondary-button" data-add-param>+ field</button></div></details></details>`;
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
