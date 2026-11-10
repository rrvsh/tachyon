import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultAgent } from "../../src/agents/agents";
import { openAICompatibleTransport } from "../../src/requests/openaiCompatible";

function sseResponse(chunks: string[]): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks)
          controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe("openAICompatibleTransport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the exact endpoint and optional Bearer key without OpenRouter headers", async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const connection = {
      id: "c_example",
      name: "Example",
      endpointUrl: "https://api.example.com/v1/chat/completions",
      createdAt: 1,
      updatedAt: 1,
      archived: false,
    };
    const deltas: Array<{ content?: string; reasoning?: string }> = [];

    await openAICompatibleTransport(connection).stream(
      {
        agent: {
          ...defaultAgent(),
          model: "example-model",
          params: { temperature: 0.2, custom_options: { enabled: true } },
          connectionId: connection.id,
        },
        turns: [{ role: "user", content: "hi" }],
        sessionId: "session1",
        apiKey: "secret",
        signal: new AbortController().signal,
      },
      (delta) => {
        deltas.push(delta);
      },
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(connection.endpointUrl);
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer secret",
    });
    expect(init.headers).not.toHaveProperty("HTTP-Referer");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "example-model",
      messages: [{ role: "user", content: "hi" }],
      stream: true,
      custom_options: { enabled: true },
    });
    expect(deltas).toEqual([
      { content: undefined, reasoning: "think", reasoningDetails: undefined },
      { content: "hello", reasoning: undefined, reasoningDetails: undefined },
    ]);
  });

  it("omits Authorization when the connection has no key", async () => {
    const fetchMock = vi.fn(async () => sseResponse(["data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);

    await openAICompatibleTransport({
      id: "c_no_key",
      name: "No key",
      endpointUrl: "http://localhost:11434/v1/chat/completions",
      createdAt: 1,
      updatedAt: 1,
      archived: false,
    }).stream(
      {
        agent: defaultAgent(),
        turns: [],
        sessionId: "session1",
        signal: new AbortController().signal,
      },
      () => undefined,
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });
});
