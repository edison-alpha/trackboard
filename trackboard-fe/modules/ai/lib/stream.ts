import type { AiEvent, AiRequest } from "./actions";

export class AiError extends Error {}

/**
 * Calls POST /api/ai and yields each NDJSON event as it arrives.
 * Aborting the signal stops the download and the server cancels the upstream request.
 */
export async function* streamAi(req: AiRequest, signal: AbortSignal): AsyncGenerator<AiEvent> {
  let res: Response;
  try {
    res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal });
  } catch (err) {
    if (signal.aborted) return;
    throw new AiError("Couldn't reach the server. Check your connection and try again.", { cause: err });
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AiError(body?.error ?? `The AI request failed (${res.status}).`);
  }

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
