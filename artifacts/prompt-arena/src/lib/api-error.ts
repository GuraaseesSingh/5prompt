// Errors thrown by the generated API hooks carry the HTTP status and the JSON body
// the server sent back (see lib/api-client-react/src/custom-fetch.ts, ApiError).

export function getErrorStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

/** The server's `{ error: "..." }` message if present, otherwise the given fallback. */
export function getErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { data?: { error?: unknown } } | null)?.data?.error;
  return typeof message === 'string' && message.trim() !== '' ? message : fallback;
}
