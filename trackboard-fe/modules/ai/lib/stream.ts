import { ApiError, apiFetch } from "@/lib/api/client";
import type { AiEvent, AiRequest } from "./actions";

export class AiError extends Error {}

/**
 * Calls POST /api/ai on trackboard-be and yields each NDJSON event as it arrives.
 * Aborting the signal stops the download and the server cancels the upstream request.
 */
export async function* streamAi(req: AiRequest, signal: AbortSignal): AsyncGenerator<AiEvent> {
  let res: Response;
  try {
    res = await apiFetch("/api/ai", { body: req, signal });
  } catch (err) {
    if (signal.aborted) return;
    throw new AiError(err instanceof ApiError ? err.message : "Couldn't reach the server. Check your connection and try again.", { cause: err });
  }
  if (!res.body) throw new AiError(`The AI request failed (${res.status}).`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as AiEvent;
    }
  }
}
