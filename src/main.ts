import { defaultAgent } from "./agents/agents";
import { loadState } from "./app/state";
import { getAll, putOne } from "./data/db";
import type { AgentRecord, MessageRecord } from "./data/schema";
import { normalizeMessageForDisplay } from "./messages/display";
import { finalizeStaleUnfinalizedMessages } from "./requests/lifecycle";
import {
  applyFontFamily,
  getSettings,
  saveSettings,
} from "./settings/settings";
import { maybeRunPendingGithubSync, startGithubAutosync } from "./sync/github";
import { bindEvents } from "./ui/events";
import { bindKeyboardInset } from "./ui/keyboardInset";
import { render } from "./ui/render";
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-700.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-700.css";
import "./style.css";

async function ensureDefaultAgent(): Promise<void> {
  const agents = await getAll<AgentRecord>("agents");
  if (agents.length) return;
  const agent = defaultAgent();
  await putOne("agents", agent);
  const settings = getSettings();
  if (!settings.selectedAgentId)
    saveSettings({ ...settings, selectedAgentId: agent.id });
  applyFontFamily(getSettings().fontFamily);
}

function cssAttr(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

interface StreamUpdatedDetail {
  messageId: string;
  content: string;
  reasoning?: string;
  reasoningDetails?: unknown[];
}

function updateStreamedMessageBody(
  body: HTMLElement,
  thinkingText: string,
  visibleContent: string,
): void {
  let content = body.querySelector<HTMLElement>("[data-message-content]");
  if (!content) {
    content = document.createElement("pre");
    content.dataset.messageContent = "";
    body.append(content);
  }
  content.textContent = visibleContent;

  if (!thinkingText) return;
  let block = body.querySelector<HTMLDetailsElement>("[data-thinking-block]");
  if (!block) {
    block = document.createElement("details");
    block.className = "thinking-block";
    block.dataset.thinkingBlock = "";
    block.open = getSettings().openThinkingByDefault;
    const summary = document.createElement("summary");
    summary.textContent = "thinking";
    const thinking = document.createElement("pre");
    thinking.dataset.thinkingContent = "";
    block.append(summary, thinking);
    body.insertBefore(block, content);
  }
  const thinking = block.querySelector<HTMLElement>("[data-thinking-content]");
  if (thinking) thinking.textContent = thinkingText;
}

async function boot(): Promise<void> {
  applyFontFamily(getSettings().fontFamily);
  await ensureDefaultAgent();
  await finalizeStaleUnfinalizedMessages();
  const app = document.getElementById("app");
  if (!app) throw new Error("Missing app root");
  bindEvents(app);
  bindKeyboardInset();
  const rerender = async () => render(app, await loadState());
  window.addEventListener("app:changed", () => {
    void maybeRunPendingGithubSync().then(rerender);
    void rerender();
  });
  window.addEventListener("app:stream-updated", (event) => {
    const detail = (event as CustomEvent<StreamUpdatedDetail>).detail;
    const body = app.querySelector<HTMLElement>(
      `[data-message-body="${cssAttr(detail.messageId)}"]`,
    );
    if (body) {
      const display = normalizeMessageForDisplay({
        content: detail.content,
        reasoning: detail.reasoning,
        reasoningDetails: detail.reasoningDetails,
        finalized: false,
      } as MessageRecord);
      updateStreamedMessageBody(
        body,
        display.thinkingText,
        display.visibleContent,
      );
    }
    const recentUserScroll =
      Date.now() - Number(app.dataset.lastUserScrollAt ?? 0) < 750;
    if (app.dataset.autoscroll !== "false" && !recentUserScroll) {
      app
        .querySelector<HTMLElement>("[data-scroll-anchor]")
        ?.scrollIntoView({ block: "end", behavior: "instant" });
    }
  });
  window.addEventListener("popstate", () => void rerender());
  startGithubAutosync();
  await rerender();
}

void boot().catch((error) => {
  document.body.textContent =
    error instanceof Error ? error.message : String(error);
});
