import Anthropic from "@anthropic-ai/sdk";
import { AI_ACTIONS, ASK_ACTION, CUSTOM_ACTION, MAX_INPUT_CHARS, type AiEvent, type AiRequest } from "@/modules/ai/lib/actions";
import { AI_MODEL, AiConfigError, aiClient } from "@/modules/ai/server/client";
import { CHAT_SYSTEM, SYSTEM, buildChatMessages, buildUserMessage, maxTokensFor } from "@/modules/ai/server/prompts";
import { rateLimit } from "@/modules/ai/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN = new Set<string>([...AI_ACTIONS.map((a) => a.id), CUSTOM_ACTION.selection.id, CUSTOM_ACTION.write.id, ASK_ACTION.id, "chat"]);

const json = (status: number, message: string, headers?: HeadersInit) =>
  Response.json({ error: message }, { status, headers });

function sizeOf(req: AiRequest): number {
  return (req.text?.length ?? 0) + (req.instruction?.length ?? 0) + (req.before?.length ?? 0) + (req.pages ?? []).reduce((n, p) => n + p.text.length + p.title.length, 0) + (req.messages ?? []).reduce((n, m) => n + m.content.length, 0);
}

/** Turns SDK errors into a sentence the person can act on. */
function explain(err: unknown): string | null {
  if (err instanceof Anthropic.APIUserAbortError) return null;
  if (err instanceof Anthropic.RateLimitError) return "The AI service is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return "The AI service rejected the API key. Check AI_API_KEY on the server.";
  if (err instanceof Anthropic.NotFoundError) return `The model ${AI_MODEL} isn't available on this AI service.`;
  if (err instanceof Anthropic.BadRequestError) return `The AI service refused the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Check the connection and try again.";
  if (err instanceof Anthropic.APIError) return `The AI service failed (${err.status ?? "no status"}). Try again.`;
  return "Something went wrong while generating. Try again.";
}

/** POST /api/ai: runs one action and streams NDJSON lines (AiEvent) back to the editor. */
export async function POST(request: Request) {
  let body: AiRequest;
  try {
    body = (await request.json()) as AiRequest;
  } catch {
    return json(400, "The request body isn't valid JSON.");
  }
  if (!body || !KNOWN.has(body.action)) return json(400, "Unknown AI action.");
  if (sizeOf(body) > MAX_INPUT_CHARS) return json(413, "That's too much text for one AI request. Select a smaller part and try again.");
  if ((body.action === "ask" || body.action === "write" || body.action === "custom-edit") && !body.instruction?.trim()) {
    return json(400, "Write what you want the AI to do first.");
  }

  const chat = body.action === "chat" ? buildChatMessages(body) : null;
  if (body.action === "chat" && !chat?.length) return json(400, "Write a message first.");

  const caller = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const wait = rateLimit(caller);
  if (wait > 0) return json(429, `Too many AI requests. Try again in ${wait} seconds.`, { "Retry-After": String(wait) });

  let client: Anthropic;
  try {
    client = aiClient();
  } catch (err) {
    return json(503, err instanceof AiConfigError ? "AI isn't set up on this server yet (missing AI_API_KEY)." : "AI isn't available.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AiEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        const run = client.messages.stream(
          {
            model: AI_MODEL,
            max_tokens: chat ? 2000 : maxTokensFor(body),
            // The frozen system prompt (plus anything the proxy prepends) is identical across requests: cache it.
            cache_control: { type: "ephemeral" },
            system: chat ? CHAT_SYSTEM : SYSTEM,
            messages: chat ?? [{ role: "user", content: buildUserMessage(body) }],
          },
          { signal: request.signal },
        );
        for await (const event of run) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ t: "delta", v: event.delta.text });
        }
        const final = await run.finalMessage();
        const u = final.usage;
        console.info(`[ai] ${body.action} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens} stop=${final.stop_reason}`);
        send({ t: "done", usage: { input: final.usage.input_tokens, output: final.usage.output_tokens }, cut: final.stop_reason === "max_tokens" });
      } catch (err) {
        const message = explain(err);
        if (message) {
          console.warn(`[ai] ${body.action} failed:`, err instanceof Error ? err.message : err);
          send({ t: "error", message });
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* client already went away */
        }
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
