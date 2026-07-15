import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultAgent, makeAgent } from "../../src/agents/agents";
import { resolveAgentProvider } from "../../src/agents/providers";
import {
  getParamSectionsForAgent,
  openRouterParamSections,
  render,
} from "../../src/ui/render";
import { DEFAULT_FONT_FAMILY, saveSettings } from "../../src/settings/settings";
import type { AppState } from "../../src/app/state";

function emptyState(agent = defaultAgent()): AppState {
  return {
    sessionId: null,
    session: null,
    sessions: [],
    archivedSessions: [],
    messages: [],
    visible: [],
    agents: [agent],
    currentMessageId: null,
    errors: [],
    info: [],
  };
}

describe("agent provider resolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("returns openrouter for arbitrary agents", () => {
    expect(resolveAgentProvider(defaultAgent())).toBe("openrouter");
    expect(
      resolveAgentProvider(
        makeAgent({ name: "Arbitrary", model: "not/openrouter/specific" }),
      ),
    ).toBe("openrouter");
    expect(
      resolveAgentProvider(makeAgent({ name: "Plain", model: "gpt-5" })),
    ).toBe("openrouter");
  });

  it("returns OpenRouter param sections for current agents", () => {
    expect(getParamSectionsForAgent(defaultAgent())).toBe(
      openRouterParamSections,
    );
    expect(
      openRouterParamSections.some((section) => section.title === "routing"),
    ).toBe(true);
  });

  it("renders OpenRouter params in the current agent form", () => {
    localStorage.clear();
    const agent = defaultAgent();
    saveSettings({
      openRouterApiKey: "",
      selectedAgentId: agent.id,
      fontFamily: DEFAULT_FONT_FAMILY,
      openThinkingByDefault: true,
      rightSidebarCollapsed: false,
    });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    Element.prototype.scrollIntoView = vi.fn();
    const app = document.createElement("div");
    app.dataset.rightSidebarTab = "agents";
    app.dataset.agentFormMode = "edit";
    app.dataset.agentFormId = agent.id;

    render(app, emptyState(agent));

    expect(app.querySelector(".params-grid")?.textContent).toContain(
      "OpenRouter params",
    );
    expect(app.querySelector(".extra-config")?.textContent).toContain(
      "Add advanced OpenRouter request parameters not listed above.",
    );
    expect(app.querySelector('[name="param:temperature"]')).not.toBeNull();
  });
});
