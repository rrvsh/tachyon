const DRAFT_PREFIX = "tachyon-composer-draft:";

export function composerDraftKey(sessionId: string | null): string {
  return `${DRAFT_PREFIX}${sessionId ?? "new"}`;
}

export function readComposerDraft(sessionId: string | null): string {
  return localStorage.getItem(composerDraftKey(sessionId)) ?? "";
}

export function writeComposerDraft(
  sessionId: string | null,
  value: string,
): void {
  const key = composerDraftKey(sessionId);
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

export function clearComposerDraft(sessionId: string | null): void {
  localStorage.removeItem(composerDraftKey(sessionId));
}
