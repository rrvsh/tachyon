export interface TransportRequest {
  payload: Record<string, unknown>;
  apiKey?: string;
  signal: AbortSignal;
}

export interface Transport {
  stream(
    request: TransportRequest,
    onDelta: (delta: string) => Promise<void> | void,
  ): Promise<void>;
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
