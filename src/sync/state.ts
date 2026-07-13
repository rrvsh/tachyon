import type { ImportAnalysis } from "../data/importExport";

const KEY = "tachyon-github-sync";

export type AutosyncMode = "off" | "30s";
export type SyncStatus =
  | "not configured"
  | "synced"
  | "local changes"
  | "autosync pending"
  | "syncing"
  | "conflict"
  | "error";

export interface GithubSyncConfig {
  repository: string;
  branch: string;
  path: string;
  token: string;
  autosync: AutosyncMode;
}

export interface GithubSyncState {
  config: GithubSyncConfig;
  remoteSha: string | null;
  dirtySince: number | null;
  lastSync: number | null;
  lastPull: number | null;
  lastPush: number | null;
  status: SyncStatus;
  error: string | null;
  conflictSummary: ImportAnalysis["summary"] | null;
  pendingImportText: string | null;
  pendingImportReview: Omit<ImportAnalysis, "file"> | null;
  autosyncPending: boolean;
}

export const DEFAULT_SYNC_PATH = "tachyon-sync.json";

export function defaultGithubSyncState(): GithubSyncState {
  return {
    config: {
      repository: "",
      branch: "",
      path: DEFAULT_SYNC_PATH,
      token: "",
      autosync: "off",
    },
    remoteSha: null,
    dirtySince: null,
    lastSync: null,
    lastPull: null,
    lastPush: null,
    status: "not configured",
    error: null,
    conflictSummary: null,
    pendingImportText: null,
    pendingImportReview: null,
    autosyncPending: false,
  };
}

export function getGithubSyncState(): GithubSyncState {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(KEY) || "{}",
    ) as Partial<GithubSyncState>;
    const defaults = defaultGithubSyncState();
    return {
      ...defaults,
      ...parsed,
      config: { ...defaults.config, ...(parsed.config ?? {}) },
    };
  } catch {
    return defaultGithubSyncState();
  }
}

export function saveGithubSyncState(state: GithubSyncState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function updateGithubSyncState(
  patch: Partial<GithubSyncState>,
): GithubSyncState {
  const next = { ...getGithubSyncState(), ...patch };
  saveGithubSyncState(next);
  return next;
}

export function updateGithubSyncConfig(
  patch: Partial<GithubSyncConfig>,
): GithubSyncState {
  const current = getGithubSyncState();
  const next = {
    ...current,
    config: { ...current.config, ...patch },
  };
  if (!isGithubSyncConfigured(next)) next.status = "not configured";
  saveGithubSyncState(next);
  return next;
}

export function isGithubSyncConfigured(state = getGithubSyncState()): boolean {
  return !!(
    state.config.repository.trim() &&
    state.config.path.trim() &&
    state.config.token.trim()
  );
}

export function markGithubSyncDirty(): void {
  const state = getGithubSyncState();
  if (state.dirtySince) return;
  saveGithubSyncState({
    ...state,
    dirtySince: Date.now(),
    status: !isGithubSyncConfigured(state)
      ? "not configured"
      : state.status === "conflict"
        ? "conflict"
        : "local changes",
  });
}
