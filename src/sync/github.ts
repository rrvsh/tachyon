import { analyzeImport, createExport, importFile } from "../data/importExport";
import { validateExportFile } from "../data/validation";
import { requestRegistry } from "../requests/lifecycle";
import {
  DEFAULT_SYNC_PATH,
  getGithubSyncState,
  isGithubSyncConfigured,
  saveGithubSyncState,
  updateGithubSyncState,
  type GithubSyncConfig,
  type GithubSyncState,
} from "./state";

interface RemoteFile {
  text: string;
  sha: string;
}

interface GithubContentFile {
  content?: string;
  encoding?: string;
  sha?: string;
  type?: string;
}

interface GithubBlob {
  content?: string;
  encoding?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function byId<T extends { id: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => a.id.localeCompare(b.id));
}

function exportDataEqualIgnoringExportedAt(
  left: Awaited<ReturnType<typeof createExport>>,
  right: Awaited<ReturnType<typeof createExport>>,
): boolean {
  return (
    JSON.stringify({
      version: left.version,
      sessions: byId(left.sessions),
      messages: byId(left.messages),
      agents: byId(left.agents),
    }) ===
    JSON.stringify({
      version: right.version,
      sessions: byId(right.sessions),
      messages: byId(right.messages),
      agents: byId(right.agents),
    })
  );
}

function parseRepository(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.trim().split("/");
  if (!owner || !repo) throw new Error("GitHub repository must be owner/repo.");
  return { owner, repo };
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function isGithubShaMismatch(error: unknown): boolean {
  return error instanceof Error && /GitHub 409:/.test(error.message);
}

async function githubFetch<T>(
  config: GithubSyncConfig,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub ${response.status}: ${body || response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

async function defaultBranch(config: GithubSyncConfig): Promise<string> {
  if (config.branch.trim()) return config.branch.trim();
  const { owner, repo } = parseRepository(config.repository);
  const data = await githubFetch<{ default_branch: string }>(
    config,
    `https://api.github.com/repos/${owner}/${repo}`,
  );
  return data.default_branch;
}

async function fetchBlobText(
  config: GithubSyncConfig,
  owner: string,
  repo: string,
  sha: string,
): Promise<string> {
  const blob = await githubFetch<GithubBlob>(
    config,
    `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`,
  );
  if (typeof blob.content !== "string" || blob.encoding !== "base64") {
    throw new Error(
      "Remote file content is unavailable from GitHub. Use a smaller JSON file path.",
    );
  }
  return decodeBase64(blob.content);
}

export async function fetchRemoteFile(
  config: GithubSyncConfig,
): Promise<RemoteFile | null> {
  const { owner, repo } = parseRepository(config.repository);
  const branch = await defaultBranch(config);
  const path = config.path.trim() || DEFAULT_SYNC_PATH;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub ${response.status}: ${body || response.statusText}`,
    );
  }
  const data = (await response.json()) as GithubContentFile | unknown[];
  if (Array.isArray(data)) {
    throw new Error(
      "Remote path points to a directory. Choose a JSON file path such as tachyon-sync.json.",
    );
  }
  if (data.type && data.type !== "file") {
    throw new Error(`Remote path is a ${data.type}, not a file.`);
  }
  if (!data.sha) throw new Error("Remote file is missing a GitHub SHA.");
  if (data.encoding === "base64" && typeof data.content === "string") {
    return { text: decodeBase64(data.content), sha: data.sha };
  }
  return {
    text: await fetchBlobText(config, owner, repo, data.sha),
    sha: data.sha,
  };
}

export async function pushRemoteFile(
  config: GithubSyncConfig,
  text: string,
  sha: string | null,
): Promise<string> {
  const { owner, repo } = parseRepository(config.repository);
  const branch = await defaultBranch(config);
  const path = config.path.trim() || DEFAULT_SYNC_PATH;
  const result = await githubFetch<{ content: { sha: string } }>(
    config,
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: "Sync Tachyon data",
        content: encodeBase64(text),
        branch,
        ...(sha ? { sha } : {}),
      }),
    },
  );
  return result.content.sha;
}

export async function runGithubFullSync(
  retryOnShaMismatch = true,
): Promise<GithubSyncState> {
  let state = getGithubSyncState();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return updateGithubSyncState({
      status: "error",
      error: "Network is offline. Reconnect before syncing.",
      autosyncPending: false,
    });
  }
  if (!isGithubSyncConfigured(state))
    return updateGithubSyncState({ status: "not configured" });
  if (state.status === "conflict") return state;
  if (requestRegistry.size) {
    return updateGithubSyncState({
      status: "autosync pending",
      autosyncPending: true,
    });
  }
  if (
    (window as unknown as { __tachyonSyncRunning?: boolean })
      .__tachyonSyncRunning
  )
    return state;
  (
    window as unknown as { __tachyonSyncRunning?: boolean }
  ).__tachyonSyncRunning = true;
  state = updateGithubSyncState({ status: "syncing", error: null });
  try {
    const remote = await fetchRemoteFile(state.config);
    if (!remote) {
      const exportText = JSON.stringify(await createExport(), null, 2);
      const sha = await pushRemoteFile(state.config, exportText, null);
      const now = Date.now();
      return updateGithubSyncState({
        remoteSha: sha,
        dirtySince: null,
        lastPush: now,
        lastSync: now,
        status: "synced",
        error: null,
        conflictSummary: null,
        pendingImportText: null,
        pendingImportReview: null,
        autosyncPending: false,
      });
    }

    const parsed = JSON.parse(remote.text) as unknown;
    if (!validateExportFile(parsed)) throw new Error("Remote file is invalid.");
    const review = await analyzeImport(parsed);
    const hasConflicts = Object.values(review.summary ?? {}).some(
      (bucket) => bucket.quarantined > 0,
    );
    const now = Date.now();
    if (hasConflicts) {
      return updateGithubSyncState({
        remoteSha: remote.sha,
        lastPull: now,
        status: "conflict",
        conflictSummary: null,
        pendingImportText: remote.text,
        pendingImportReview: null,
        autosyncPending: false,
      });
    }

    await importFile(parsed);
    const exportFile = await createExport();
    if (exportDataEqualIgnoringExportedAt(exportFile, parsed)) {
      return updateGithubSyncState({
        remoteSha: remote.sha,
        dirtySince: null,
        lastPull: now,
        lastSync: Date.now(),
        status: "synced",
        error: null,
        conflictSummary: null,
        pendingImportText: null,
        pendingImportReview: null,
        autosyncPending: false,
      });
    }
    const exportText = JSON.stringify(exportFile, null, 2);
    const latestRemote = await fetchRemoteFile(state.config);
    const sha = await pushRemoteFile(
      state.config,
      exportText,
      latestRemote?.sha ?? null,
    );
    const done = Date.now();
    return updateGithubSyncState({
      remoteSha: sha,
      dirtySince: null,
      lastPull: now,
      lastPush: done,
      lastSync: done,
      status: "synced",
      error: null,
      conflictSummary: null,
      pendingImportText: null,
      pendingImportReview: null,
      autosyncPending: false,
    });
  } catch (error) {
    if (retryOnShaMismatch && isGithubShaMismatch(error)) {
      (
        window as unknown as { __tachyonSyncRunning?: boolean }
      ).__tachyonSyncRunning = false;
      await sleep(1000);
      return runGithubFullSync(false);
    }
    return updateGithubSyncState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      autosyncPending: false,
    });
  } finally {
    (
      window as unknown as { __tachyonSyncRunning?: boolean }
    ).__tachyonSyncRunning = false;
  }
}

export async function overwriteGithubRemote(
  retryOnShaMismatch = true,
): Promise<GithubSyncState> {
  const state = getGithubSyncState();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return updateGithubSyncState({
      status: "error",
      error: "Network is offline. Reconnect before syncing.",
      autosyncPending: false,
    });
  }
  if (!isGithubSyncConfigured(state))
    return updateGithubSyncState({ status: "not configured" });
  try {
    const currentRemote = await fetchRemoteFile(state.config);
    const exportText = JSON.stringify(await createExport(), null, 2);
    const sha = await pushRemoteFile(
      state.config,
      exportText,
      currentRemote?.sha ?? null,
    );
    const now = Date.now();
    return updateGithubSyncState({
      remoteSha: sha,
      dirtySince: null,
      lastPush: now,
      lastSync: now,
      status: "synced",
      error: null,
      conflictSummary: null,
      pendingImportText: null,
      pendingImportReview: null,
      autosyncPending: false,
    });
  } catch (error) {
    if (retryOnShaMismatch && isGithubShaMismatch(error)) {
      await sleep(1000);
      return overwriteGithubRemote(false);
    }
    return updateGithubSyncState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      autosyncPending: false,
    });
  }
}

export async function maybeRunPendingGithubSync(): Promise<boolean> {
  const state = getGithubSyncState();
  if (!state.autosyncPending || requestRegistry.size) return false;
  await runGithubFullSync();
  return true;
}

export function startGithubAutosync(): void {
  window.setInterval(() => {
    const state = getGithubSyncState();
    if (state.config.autosync !== "30s") return;
    if (!state.dirtySince && state.remoteSha) return;
    void runGithubFullSync().then(() =>
      window.dispatchEvent(new CustomEvent("app:changed")),
    );
  }, 30000);
}
