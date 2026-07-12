import type { SettingsRecord } from "../data/schema";

const KEY = "tachyon-settings";
const POINTER_PREFIX = "tachyon-current-message:";

export function getSettings(): SettingsRecord {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(KEY) || "{}",
    ) as Partial<SettingsRecord>;
    return {
      apiKey: parsed.apiKey ?? "",
      selectedAgentId: parsed.selectedAgentId ?? null,
    };
  } catch {
    return { apiKey: "", selectedAgentId: null };
  }
}

export function saveSettings(settings: SettingsRecord): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
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
