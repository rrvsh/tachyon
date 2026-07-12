import type { AgentRecord } from "../data/schema";
import type { AppState } from "../app/state";
import { siblings } from "../messages/tree";
import { currentSettings, viewedHasInflight } from "../app/actions";

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
  const previousConversation = app.querySelector<HTMLElement>(".conversation");
  const previousScrollTop = previousConversation?.scrollTop ?? 0;
  const openDialogId = app.querySelector<HTMLDialogElement>("dialog[open]")?.id;
  const sessionChanged = previousSessionId !== nextSessionId;
  const shouldAutoScroll =
    !previousConversation ||
    sessionChanged ||
    app.dataset.autoscroll !== "false";

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Sessions">
        <div class="sidebar-top">
          <div class="app-mark" aria-label="Tachyon">Tachyon</div>
          <button class="icon-button primary-button" data-action="new-session" aria-label="New chat" title="New chat">+</button>
        </div>
        <nav class="session-nav">
          <h2>sessions</h2>
          <ul>${state.sessions.map((s) => `<li class="session-row"><button class="session-link ${state.session?.id === s.id ? "active" : ""}" data-open-session="${s.id}" title="Open chat">${esc(s.title)}</button><button class="icon-button ghost-button" data-archive-session="${s.id}" aria-label="Archive chat" title="Archive chat">×</button></li>`).join("")}</ul>
          <details class="archive-panel"><summary>archived</summary><ul>${state.archivedSessions.map((s) => `<li class="session-row"><button class="session-link" data-open-session="${s.id}" title="Open archived chat">${esc(s.title)}</button><button class="icon-button ghost-button" data-unarchive-session="${s.id}" aria-label="Restore chat" title="Restore chat">↩</button></li>`).join("")}</ul></details>
        </nav>
      </aside>

      <main class="chat-panel">
        <header class="chat-header">
          <div class="chat-title">${state.session ? esc(state.session.title) : "new session"}${new URLSearchParams(location.search).has("debug") ? '<span class="debug-pill">debug</span>' : ""}</div>
          <div class="header-actions">
            <button class="icon-button" data-open-dialog="settings-dialog" aria-label="Settings" title="Settings">[cfg]</button>
            <button class="icon-button" data-open-dialog="agents-dialog" aria-label="Agents" title="Agents">[agt]</button>
            <button class="icon-button" data-action="export" aria-label="Export" title="Export">[out]</button>
            <label class="icon-button import-button" aria-label="Import" title="Import">[in]<input data-action="import" type="file" accept="application/json"></label>
          </div>
        </header>
        <div class="notices">${state.errors.map((e) => `<p class="error">${esc(e)}</p>`).join("")}${state.info.map((e) => `<p class="info">${esc(e)}</p>`).join("")}</div>
        <section class="conversation">
          ${state.session ? renderMessages(state) : renderBlankState()}
          <div class="scroll-anchor" data-scroll-anchor></div>
        </section>
        ${renderComposer(state)}
      </main>

      ${renderSettingsDialog(settings, state)}
      ${renderAgentsDialog(state)}
    </div>`;

  app.dataset.renderSessionId = nextSessionId;
  if (sessionChanged || app.dataset.autoscroll === undefined) {
    app.dataset.autoscroll = "true";
  }

  const conversation = app.querySelector<HTMLElement>(".conversation");
  if (conversation) {
    bindScrollIntent(app, conversation);
    requestAnimationFrame(() => {
      if (shouldAutoScroll) {
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
  return `<div class="blank-state" data-testid="blank"><h2>Tachyon</h2></div>`;
}

function renderMessages(state: AppState): string {
  return `<ol class="messages">${state.visible
    .map((m) => {
      const sibs = siblings(state.messages, m);
      const idx = sibs.findIndex((s) => s.id === m.id);
      const branchControls =
        sibs.length > 1
          ? `<div class="branch-controls"><button class="icon-button borderless-icon" data-branch-prev="${m.id}" aria-label="Previous branch" title="Previous branch">&lt;</button><span>${idx + 1}/${sibs.length}</span><button class="icon-button borderless-icon" data-branch-next="${m.id}" aria-label="Next branch" title="Next branch">&gt;</button></div>`
          : "";
      return `<li data-message-id="${m.id}" class="message ${m.role}"><div class="message-card"><div class="message-meta"><strong>${m.role === "assistant" ? "assistant" : "user"}</strong></div><pre data-message-content="${m.id}">${esc(m.content)}</pre><div class="message-controls">${branchControls}<div class="message-actions"><button class="icon-button borderless-icon" data-edit="${m.id}" aria-label="Edit" title="Edit">edit</button><button class="icon-button borderless-icon" data-fork="${m.id}" aria-label="Fork" title="Fork">fork</button><button class="icon-button borderless-icon" data-edit-fork="${m.id}" aria-label="Edit and fork" title="Edit and fork">split</button>${m.role === "assistant" ? `<button class="icon-button borderless-icon" data-regenerate="${m.id}" aria-label="Regenerate" title="Regenerate">redo</button>` : ""}</div></div></div></li>`;
    })
    .join("")}</ol>`;
}

function renderComposer(state: AppState): string {
  const abort = viewedHasInflight();
  const agent = state.agents.find(
    (a) => a.id === currentSettings().selectedAgentId,
  );
  return `<form class="composer" data-compose><div class="composer-context">${agent ? `agent: ${esc(agent.name)}` : "agent: none"}</div><div class="composer-box"><textarea name="message" placeholder="Message (empty for assistant-only)"></textarea><button class="icon-button send-button" type="submit" aria-label="${abort ? "Abort" : "Send"}" title="${abort ? "Abort" : "Send"}">${abort ? "stop" : "send"}</button></div></form>`;
}

function renderSettingsDialog(
  settings: { apiKey: string; selectedAgentId: string | null },
  state: AppState,
): string {
  return `<dialog id="settings-dialog" class="modal"><section class="panel"><div class="modal-heading"><h2>settings</h2><button class="icon-button borderless-icon modal-close-button" type="button" data-close-dialog aria-label="Close settings" title="Close settings">×</button></div><label>OpenRouter API key <input data-setting-api-key type="password" value="${esc(settings.apiKey)}" placeholder="sk-or-..."></label><label>agent <select data-setting-agent>${state.agents
    .filter((a) => !a.archived)
    .map(
      (a) =>
        `<option value="${a.id}" ${settings.selectedAgentId === a.id ? "selected" : ""}>${esc(a.name)}</option>`,
    )
    .join(
      "",
    )}</select></label><div class="settings-actions"><button class="primary-button save-settings-button" data-save-settings>save</button></div></section></dialog>`;
}

function renderAgentsDialog(state: AppState): string {
  return `<dialog id="agents-dialog" class="modal wide-modal"><section class="panel"><div class="modal-heading"><h2>agents</h2><button class="icon-button borderless-icon modal-close-button" type="button" data-close-dialog aria-label="Close agents" title="Close agents">×</button></div><form class="agent-form" data-agent-form><input type="hidden" name="id"><label>name<input name="name" placeholder="concise assistant"></label><label>model slug<input name="model" placeholder="openai/gpt-4o-mini"></label><label>system prompt<textarea name="systemPrompt" placeholder="You are concise and practical."></textarea></label>${renderParamFields()}<button class="primary-button save-agent-button" aria-label="Save agent" title="Save agent">save agent</button></form><ul class="agent-list">${state.agents.map((a) => renderAgentRow(a)).join("")}</ul></section></dialog>`;
}

function renderParamFields(): string {
  return `<fieldset class="params-grid"><legend><a href="https://openrouter.ai/docs/api/reference/parameters" target="_blank" rel="noreferrer">params</a></legend>${paramSections
    .map(
      (section) =>
        `<fieldset class="param-section"><legend>${esc(section.title)}</legend>${section.fields.map((field) => renderParamField(field)).join("")}</fieldset>`,
    )
    .join(
      "",
    )}<fieldset class="extra-config"><legend>extra config</legend><p class="field-help">Add provider-specific or advanced OpenRouter request parameters not listed above.</p><div class="extra-param-list" data-extra-param-list></div><button type="button" class="secondary-button" data-add-param>+ field</button></fieldset></fieldset>`;
}

function renderParamField(field: ParamField): string {
  const control = field.options
    ? `<select data-param-path="${field.key}" name="param:${field.key}">${field.options.map((option) => `<option value="${attr(option.value)}">${esc(option.label)}</option>`).join("")}</select>`
    : `<input data-param-path="${field.key}" name="param:${field.key}" type="${field.type ?? "text"}" step="any" placeholder="${attr(field.placeholder)}">`;
  return `<label>${field.label}${control}<span class="field-help">${esc(field.description)}</span></label>`;
}

function renderAgentRow(agent: AgentRecord): string {
  const params = esc(JSON.stringify(agent.params));
  return `<li data-agent-id="${agent.id}" data-agent-name="${attr(agent.name)}" data-agent-model="${attr(agent.model)}" data-agent-system-prompt="${attr(agent.systemPrompt)}" data-agent-params="${params}"><div><strong>${esc(agent.name)}</strong><code>${esc(agent.model)}</code>${agent.archived ? '<span class="muted"> archived</span>' : ""}</div><div><button class="icon-button" data-agent-edit="${agent.id}" aria-label="Edit agent" title="Edit agent">✎</button><button class="icon-button" data-agent-archive="${agent.id}" aria-label="${agent.archived ? "Restore agent" : "Archive agent"}" title="${agent.archived ? "Restore agent" : "Archive agent"}">${agent.archived ? "↩" : "×"}</button></div></li>`;
}
