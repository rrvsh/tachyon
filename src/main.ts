import { defaultAgent } from "./agents/agents";
import { loadState } from "./app/state";
import { getAll, putOne } from "./data/db";
import type { AgentRecord } from "./data/schema";
import { finalizeStaleUnfinalizedMessages } from "./requests/lifecycle";
import { getSettings, saveSettings } from "./settings/settings";
import { bindEvents } from "./ui/events";
import { render } from "./ui/render";
import "./style.css";

async function ensureDefaultAgent(): Promise<void> {
  const agents = await getAll<AgentRecord>("agents");
  if (agents.length) return;
  const agent = defaultAgent();
  await putOne("agents", agent);
  const settings = getSettings();
  if (!settings.selectedAgentId)
    saveSettings({ ...settings, selectedAgentId: agent.id });
}

async function boot(): Promise<void> {
  await ensureDefaultAgent();
  await finalizeStaleUnfinalizedMessages();
  const app = document.getElementById("app");
  if (!app) throw new Error("Missing app root");
  bindEvents(app);
  const rerender = async () => render(app, await loadState());
  window.addEventListener("app:changed", () => void rerender());
  window.addEventListener("popstate", () => void rerender());
  await rerender();
}

void boot().catch((error) => {
  document.body.textContent =
    error instanceof Error ? error.message : String(error);
});
