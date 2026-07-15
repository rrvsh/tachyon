import { describe, expect, it, vi, afterEach } from "vitest";
import { defaultAgent } from "../../src/agents/agents";
import { openRouterTransport } from "../../src/requests/openrouter";

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

describe("openRouterTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the same OpenRouter request body from neutral transport input", async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const agent = {
      ...defaultAgent(),
      model: "openai/gpt-4o-mini",
      systemPrompt: "system",
      params: { temperature: 0.2 },
    };
    const deltas: string[] = [];

    await openRouterTransport.stream(
      {
        agent,
        turns: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "hi before" },
        ],
        sessionId: "sess1234",
        openRouterApiKey: "sk-or-test",
        signal: new AbortController().signal,
      },
      (delta) => {
        if (delta.content) deltas.push(delta.content);
      },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer sk-or-test",
      "X-Title": "Tachyon",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      temperature: 0.2,
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "system" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi before" },
      ],
      stream: true,
    });
    expect(deltas).toEqual(["hi"]);
  });
});
