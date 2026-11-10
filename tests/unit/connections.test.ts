import { beforeEach, describe, expect, it } from "vitest";
import {
  makeConnection,
  validateConnectionConfig,
} from "../../src/connections/connections";
import {
  getConnectionApiKey,
  getSettings,
  saveConnectionApiKey,
} from "../../src/settings/settings";

describe("connections", () => {
  beforeEach(() => localStorage.clear());

  it("accepts HTTP and HTTPS Chat Completions URLs", () => {
    expect(
      validateConnectionConfig(
        makeConnection({
          name: "Hosted",
          endpointUrl: "https://api.example.com/v1/chat/completions",
        }),
      ),
    ).toEqual([]);
    expect(
      validateConnectionConfig(
        makeConnection({
          name: "Local",
          endpointUrl: "http://localhost:11434/v1/chat/completions",
        }),
      ),
    ).toEqual([]);
  });

  it("rejects embedded credentials, fragments, and non-HTTP URLs", () => {
    expect(
      validateConnectionConfig(
        makeConnection({
          name: "Bad",
          endpointUrl: "https://user:pass@example.com/v1#secret",
        }),
      ),
    ).toEqual([
      "Connection URL must not contain credentials.",
      "Connection URL must not contain a fragment.",
    ]);
    expect(
      validateConnectionConfig(
        makeConnection({ name: "Bad", endpointUrl: "file:///tmp/api" }),
      ),
    ).toContain("Connection URL must use HTTP or HTTPS.");
  });

  it("stores and forgets keys only in local settings", () => {
    saveConnectionApiKey("c_test", "  secret  ");
    expect(getConnectionApiKey("c_test")).toBe("secret");
    expect(getSettings().connectionApiKeys).toEqual({ c_test: "secret" });

    saveConnectionApiKey("c_test", "");
    expect(getConnectionApiKey("c_test")).toBe("");
    expect(getSettings().connectionApiKeys).toEqual({});
  });
});
