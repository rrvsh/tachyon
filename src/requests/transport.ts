export interface TransportRequest {
  payload: Record<string, unknown>;
  apiKey?: string;
  signal: AbortSignal;
}

export interface TransportDelta {
  content?: string;
  reasoning?: string;
  reasoningDetails?: unknown[];
}

export interface Transport {
  stream(
    request: TransportRequest,
    onDelta: (delta: TransportDelta) => Promise<void> | void,
  ): Promise<void>;
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
