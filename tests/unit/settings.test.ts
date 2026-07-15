import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_FAMILY,
  getSettings,
  saveSettings,
} from "../../src/settings/settings";

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads legacy apiKey as openRouterApiKey", () => {
    localStorage.setItem(
      "tachyon-settings",
      JSON.stringify({
        apiKey: "sk-or-legacy",
        selectedAgentId: "agent1",
        fontFamily: DEFAULT_FONT_FAMILY,
      }),
    );

    expect(getSettings()).toMatchObject({
      openRouterApiKey: "sk-or-legacy",
      selectedAgentId: "agent1",
    });
  });

  it("saves only openRouterApiKey", () => {
    saveSettings({
      openRouterApiKey: "sk-or-new",
      selectedAgentId: null,
      fontFamily: DEFAULT_FONT_FAMILY,
      openThinkingByDefault: true,
      rightSidebarCollapsed: false,
    });

    const raw = JSON.parse(localStorage.getItem("tachyon-settings") ?? "{}");
    expect(raw.openRouterApiKey).toBe("sk-or-new");
    expect(raw).not.toHaveProperty("apiKey");
  });
});
