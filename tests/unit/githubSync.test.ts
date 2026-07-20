import { describe, expect, it, vi } from "vitest";
import { fetchRemoteFile } from "../../src/sync/github";
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
});
