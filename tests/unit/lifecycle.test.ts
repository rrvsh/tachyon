import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAgent } from "../../src/agents/agents";
import { send } from "../../src/app/actions";
import { clearDbForTests, getAll, putOne } from "../../src/data/db";
import type { MessageRecord, SessionRecord } from "../../src/data/schema";
import { requestRegistry, startRequest } from "../../src/requests/lifecycle";
import {
  DEFAULT_FONT_FAMILY,
  saveSettings,
  setCurrentPointer,
} from "../../src/settings/settings";

describe("request lifecycle", () => {
  beforeEach(async () => {
    localStorage.clear();
    requestRegistry.clear();
    await clearDbForTests();
    const a = defaultAgent();
    await putOne("agents", a);
    saveSettings({
      apiKey: "",
      selectedAgentId: a.id,
      fontFamily: DEFAULT_FONT_FAMILY,
      openThinkingByDefault: true,
      rightSidebarCollapsed: false,
    });
    history.replaceState(null, "", "?debug=1");
  });
  it("creates session, user, assistant and finalizes streamed assistant", async () => {
    await startRequest({
      sessionId: null,
      parentId: null,
      text: "hello",
      notify: vi.fn(),
      transport: {
        async stream(_r, onDelta) {
          await onDelta({ content: "hi" });
        },
      },
    });
    await vi.waitFor(async () => expect(requestRegistry.size).toBe(0));
    const messages = (await getAll<MessageRecord>("messages")).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages.find((m) => m.role === "assistant")).toMatchObject({
      content: "hi",
      finalized: true,
    });
  });
  it("omits tombstoned messages from request payload context", async () => {
    const session: SessionRecord = {
      id: "delctx01",
      title: "s",
      createdAt: 1,
      updatedAt: 1,
      archived: false,
      rootMessageId: "u1",
    };
    await putOne("sessions", session);
    const chain: MessageRecord[] = [
      {
        id: "u1",
        sessionId: session.id,
        role: "user",
        content: "visible user",
        parentId: null,
        createdAt: 1,
        updatedAt: 1,
        finalized: true,
      },
      {
        id: "a1",
        sessionId: session.id,
        role: "assistant",
        content: "deleted assistant",
        parentId: "u1",
        createdAt: 2,
        updatedAt: 3,
        finalized: true,
        deletedAt: 3,
      },
      {
        id: "u2",
        sessionId: session.id,
        role: "user",
        content: "visible descendant",
        parentId: "a1",
        createdAt: 4,
        updatedAt: 4,
        finalized: true,
      },
    ];
    for (const message of chain) await putOne("messages", message);

    let payloadMessages: Array<{ role: string; content: string }> = [];
    await startRequest({
      sessionId: session.id,
      parentId: "u2",
      text: "next",
      notify: vi.fn(),
      transport: {
        async stream(request) {
          payloadMessages = request.payload.messages as Array<{
            role: string;
            content: string;
          }>;
        },
      },
    });
    await vi.waitFor(async () => expect(requestRegistry.size).toBe(0));
    await vi.waitFor(async () =>
      expect(
        (await getAll<MessageRecord>("messages")).some(
          (m) => m.role === "assistant" && m.finalized,
        ),
      ).toBe(true),
    );

    expect(payloadMessages.map((m) => m.content)).toEqual([
      "visible user",
      "visible descendant",
      "next",
    ]);
  });

  it("blocks missing api key outside debug", async () => {
    history.replaceState(null, "", "/");
    await expect(
      startRequest({
        sessionId: null,
        parentId: null,
        text: "x",
        notify: vi.fn(),
      }),
    ).rejects.toThrow("OpenRouter API key is required");
    expect(await getAll<MessageRecord>("messages")).toHaveLength(0);
  });

  it("treats a missing session query as root blank state", async () => {
    const sid = await startRequest({
      sessionId: "missing1",
      parentId: null,
      text: "new root",
      notify: vi.fn(),
      transport: {
        async stream(_r, onDelta) {
          await onDelta({ content: "created" });
        },
      },
    });
    expect(sid).not.toBe("missing1");
    await vi.waitFor(async () => expect(requestRegistry.size).toBe(0));
    expect(await getAll<SessionRecord>("sessions")).toHaveLength(1);
    expect(await getAll<MessageRecord>("messages")).toHaveLength(2);
  });

  it("synchronously blocks concurrent requests for the same existing session", async () => {
    const session: SessionRecord = {
      id: "sess1234",
      title: "s",
      createdAt: 1,
      updatedAt: 1,
      archived: false,
      rootMessageId: null,
    };
    await putOne("sessions", session);
    let release!: () => void;
    const transport = {
      async stream() {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    };
    const first = startRequest({
      sessionId: session.id,
      parentId: null,
      text: "one",
      notify: vi.fn(),
      transport,
    });
    const second = startRequest({
      sessionId: session.id,
      parentId: null,
      text: "two",
      notify: vi.fn(),
      transport,
    });
    await expect(second).rejects.toThrow("already has an inflight request");
    await first;
    expect(
      (await getAll<MessageRecord>("messages")).filter(
        (m) => m.role === "assistant",
      ),
    ).toHaveLength(1);
    release();
    await vi.waitFor(async () => expect(requestRegistry.size).toBe(0));
  });

  it("send appends to latest leaf when no current pointer is stored", async () => {
    const session: SessionRecord = {
      id: "leaf1234",
      title: "s",
      createdAt: 1,
      updatedAt: 1,
      archived: false,
      rootMessageId: "oldleaf",
    };
    await putOne("sessions", session);
    await putOne<MessageRecord>("messages", {
      id: "newleaf",
      sessionId: session.id,
      role: "assistant",
      content: "new",
      parentId: null,
      createdAt: 10,
      updatedAt: 10,
      finalized: true,
    });
    await putOne<MessageRecord>("messages", {
      id: "oldleaf",
      sessionId: session.id,
      role: "assistant",
      content: "old",
      parentId: null,
      createdAt: 1,
      updatedAt: 1,
      finalized: true,
    });
    history.replaceState(null, "", `?debug=1&session=${session.id}`);
    await send("child");
    await vi.waitFor(async () => expect(requestRegistry.size).toBe(0));
    const user = (await getAll<MessageRecord>("messages")).find(
      (m) => m.role === "user" && m.content === "child",
    );
    expect(user?.parentId).toBe("newleaf");
  });

  it("send appends to latest leaf when the stored current pointer is stale", async () => {
    const session: SessionRecord = {
      id: "stale123",
      title: "s",
      createdAt: 1,
      updatedAt: 1,
      archived: false,
      rootMessageId: "leaf0001",
    };
    await putOne("sessions", session);
    await putOne<MessageRecord>("messages", {
      id: "leaf0001",
      sessionId: session.id,
      role: "assistant",
      content: "leaf",
      parentId: null,
      createdAt: 1,
      updatedAt: 1,
      finalized: true,
    });
    setCurrentPointer(session.id, "missing-pointer");
    history.replaceState(null, "", `?debug=1&session=${session.id}`);
    await send("child");
    await vi.waitFor(async () => expect(requestRegistry.size).toBe(0));
    const user = (await getAll<MessageRecord>("messages")).find(
      (m) => m.role === "user" && m.content === "child",
    );
    expect(user?.parentId).toBe("leaf0001");
  });
});
