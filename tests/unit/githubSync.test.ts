import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDbForTests } from "../../src/data/db";
import {
  fetchRemoteFile,
  overwriteGithubRemote,
  runGithubFullSync,
} from "../../src/sync/github";
import {
  defaultGithubSyncState,
  saveGithubSyncState,
} from "../../src/sync/state";
import type { GithubSyncConfig } from "../../src/sync/state";

const config: GithubSyncConfig = {
  repository: "owner/repo",
  branch: "main",
  path: "tachyon-sync.json",
  autosync: "off",
  token: "token",
};

function mockJsonResponse(value: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => value,
    text: async () => JSON.stringify(value),
    statusText: ok ? "OK" : "Error",
  } as Response;
}

describe("github sync remote fetch", () => {
  beforeEach(async () => {
    await clearDbForTests();
    localStorage.clear();
    vi.unstubAllGlobals();
  });
  it("accepts an empty remote file as file content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockJsonResponse({ content: "", encoding: "base64", sha: "abc" }),
      ),
    );

    await expect(fetchRemoteFile(config)).resolves.toEqual({
      text: "",
      sha: "abc",
    });

    vi.unstubAllGlobals();
  });

  it("fetches the blob when GitHub omits large file content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({ content: "", encoding: "none", sha: "abc" }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({ content: "e30=", encoding: "base64" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRemoteFile(config)).resolves.toEqual({
      text: "{}",
      sha: "abc",
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://api.github.com/repos/owner/repo/git/blobs/abc",
      expect.objectContaining({ headers: expect.any(Object) }),
    );

    vi.unstubAllGlobals();
  });

  it("reports directory paths clearly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockJsonResponse([{ name: "nested.json" }])),
    );

    await expect(fetchRemoteFile(config)).rejects.toThrow(
      "Remote path points to a directory",
    );

    vi.unstubAllGlobals();
  });

  it("does not rewrite identical remote data just to change exportedAt", async () => {
    saveGithubSyncState({
      ...defaultGithubSyncState(),
      config,
      remoteSha: "current-sha",
      status: "local changes",
      dirtySince: 1,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        content: btoa(
          JSON.stringify({
            version: 1,
            exportedAt: 1,
            sessions: [],
            messages: [],
            agents: [],
          }),
        ),
        encoding: "base64",
        sha: "current-sha",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(runGithubFullSync()).resolves.toMatchObject({
      remoteSha: "current-sha",
      status: "synced",
      dirtySince: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("overwrites using the current remote sha instead of stored state", async () => {
    saveGithubSyncState({
      ...defaultGithubSyncState(),
      config,
      remoteSha: "stale-sha",
      status: "local changes",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          content: "e30=",
          encoding: "base64",
          sha: "current-sha",
        }),
      )
      .mockResolvedValueOnce(mockJsonResponse({ content: { sha: "new-sha" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(overwriteGithubRemote()).resolves.toMatchObject({
      remoteSha: "new-sha",
      status: "synced",
    });
    const putBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(putBody.sha).toBe("current-sha");
  });

  it("retries remote overwrite once after a sha mismatch", async () => {
    saveGithubSyncState({
      ...defaultGithubSyncState(),
      config,
      remoteSha: "stale-sha",
      status: "local changes",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          content: "e30=",
          encoding: "base64",
          sha: "sha-one",
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(
          { message: "tachyon-sync.json does not match" },
          false,
          409,
        ),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          content: "e30=",
          encoding: "base64",
          sha: "sha-two",
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({ content: { sha: "sha-three" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(overwriteGithubRemote()).resolves.toMatchObject({
      remoteSha: "sha-three",
      status: "synced",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).sha).toBe(
      "sha-one",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body)).sha).toBe(
      "sha-two",
    );
  });
});
