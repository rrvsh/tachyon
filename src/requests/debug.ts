import type { Transport } from "./transport";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export const debugTransport: Transport = {
  async stream({ payload, signal }, onDelta) {
    const text =
      new URLSearchParams(location.search).get("debugText") ||
      `Debug response for ${(payload.messages as { content: string }[] | undefined)?.at(-1)?.content ?? "assistant-only request"}.`;
    const delay = Number(
      new URLSearchParams(location.search).get("debugDelay") ?? "15",
    );
    if (new URLSearchParams(location.search).get("debugError") === "1")
      throw new Error("Simulated debug transport error.");
    for (const token of text.split(/(\s+)/)) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      await sleep(delay, signal);
      await onDelta(token);
    }
  },
};
