import { connectionId, now, type ConnectionRecord } from "../data/schema";

export function makeConnection(
  input: Partial<ConnectionRecord> &
    Pick<ConnectionRecord, "name" | "endpointUrl">,
): ConnectionRecord {
  const ts = now();
  return {
    id: input.id ?? connectionId(),
    name: input.name.trim(),
    endpointUrl: input.endpointUrl.trim(),
    createdAt: input.createdAt ?? ts,
    updatedAt: ts,
    archived: input.archived ?? false,
  };
}

export function validateConnectionConfig(
  connection: ConnectionRecord,
): string[] {
  const errors: string[] = [];
  if (!connection.name) errors.push("Connection name is required.");
  if (!connection.endpointUrl) errors.push("Chat Completions URL is required.");
  try {
    const url = new URL(connection.endpointUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      errors.push("Connection URL must use HTTP or HTTPS.");
    if (url.username || url.password)
      errors.push("Connection URL must not contain credentials.");
    if (url.hash) errors.push("Connection URL must not contain a fragment.");
  } catch {
    if (connection.endpointUrl)
      errors.push("Connection URL must be a valid URL.");
  }
  return errors;
}
