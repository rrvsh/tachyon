import type { SettingsRecord } from "../data/schema";

const KEY = "tachyon-settings";
const POINTER_PREFIX = "tachyon-current-message:";

export const DEFAULT_FONT_FAMILY =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const FONT_OPTIONS = [
  {
    label: "Atkinson Hyperlegible",
    value:
      '"Atkinson Hyperlegible", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    label: "IBM Plex Mono",
    value:
      '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  },
  {
    label: "Inter",
    value: DEFAULT_FONT_FAMILY,
  },
  {
    label: "Lora",
    value: 'Lora, ui-serif, Georgia, Cambria, "Times New Roman", serif',
  },
  {
    label: "System Mono",
    value: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  },
  {
    label: "System Sans",
    value:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    label: "System Serif",
    value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  },
] as const;

export function getSettings(): SettingsRecord {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(KEY) || "{}",
    ) as Partial<SettingsRecord>;
    return {
      apiKey: parsed.apiKey ?? "",
      selectedAgentId: parsed.selectedAgentId ?? null,
      fontFamily: parsed.fontFamily ?? DEFAULT_FONT_FAMILY,
      openThinkingByDefault: parsed.openThinkingByDefault ?? true,
      leftSidebarCollapsed: parsed.leftSidebarCollapsed ?? false,
      rightSidebarCollapsed: parsed.rightSidebarCollapsed ?? false,
    };
  } catch {
    return {
      apiKey: "",
      selectedAgentId: null,
      fontFamily: DEFAULT_FONT_FAMILY,
      openThinkingByDefault: true,
      leftSidebarCollapsed: false,
      rightSidebarCollapsed: false,
    };
  }
}

export function saveSettings(settings: SettingsRecord): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function applyFontFamily(fontFamily: string): void {
  document.documentElement.style.setProperty("--app-font-family", fontFamily);
}

export function getCurrentPointer(sessionId: string): string | null {
  return localStorage.getItem(`${POINTER_PREFIX}${sessionId}`);
}

export function setCurrentPointer(
  sessionId: string,
  messageId: string | null,
): void {
  const key = `${POINTER_PREFIX}${sessionId}`;
  if (messageId) localStorage.setItem(key, messageId);
  else localStorage.removeItem(key);
}
