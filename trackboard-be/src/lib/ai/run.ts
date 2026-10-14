import Anthropic from "@anthropic-ai/sdk";
import { AI_ACTIONS, ASK_ACTION, CUSTOM_ACTION, MAX_INPUT_CHARS, type AiEvent, type AiRequest } from "@trackboard/api-types";
import { InputError, RateLimitedError, TooLargeError, UnavailableError } from "../errors.ts";
import { log } from "../log.ts";
import { AiConfigError, aiClient, aiModel } from "./client.ts";
import { CHAT_SYSTEM, SYSTEM, buildChatMessages, buildUserMessage, maxTokensFor } from "./prompts.ts";
import { rateLimit } from "./rate-limit.ts";

const KNOWN = new Set<string>([...AI_ACTIONS.map((a) => a.id), CUSTOM_ACTION.selection.id, CUSTOM_ACTION.write.id, ASK_ACTION.id, "chat"]);

function sizeOf(req: AiRequest): number {
  return (req.text?.length ?? 0) + (req.instruction?.length ?? 0) + (req.before?.length ?? 0) + (req.pages ?? []).reduce((n, p) => n + p.text.length + p.title.length, 0) + (req.messages ?? []).reduce((n, m) => n + m.content.length, 0);
}

/** Turns SDK errors into a sentence the person can act on. */
function explain(err: unknown): string | null {
  if (err instanceof Anthropic.APIUserAbortError) return null;
  if (err instanceof Anthropic.RateLimitError) return "The AI service is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return "The AI service rejected the API key. Check AI_API_KEY on the server.";
  if (err instanceof Anthropic.NotFoundError) return `The model ${aiModel()} isn't available on this AI service.`;
  if (err instanceof Anthropic.BadRequestError) return `The AI service refused the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Check the connection and try again.";
  if (err instanceof Anthropic.APIError) return `The AI service failed (${err.status ?? "no status"}). Try again.`;
  return "Something went wrong while generating. Try again.";
}

/** Checks the request before any tokens are spent. Throws errors the route maps to 400, 413, 429 or 503. */
export function prepareAi(body: AiRequest, caller: string): { chat: ReturnType<typeof buildChatMessages> | null } {
  if (!body || !KNOWN.has(body.action)) throw new InputError("Unknown AI action.");
  if (sizeOf(body) > MAX_INPUT_CHARS) throw new TooLargeError("That's too much text for one AI request. Select a smaller part and try again.");
  if ((body.action === "ask" || body.action === "write" || body.action === "custom-edit") && !body.instruction?.trim()) throw new InputError("Write what you want the AI to do first.");
  const chat = body.action === "chat" ? buildChatMessages(body) : null;
  if (body.action === "chat" && !chat?.length) throw new InputError("Write a message first.");
  const wait = rateLimit(caller);
  if (wait > 0) throw new RateLimitedError(wait);
  try {
    aiClient();
  } catch (err) {
    throw new UnavailableError(err instanceof AiConfigError ? "AI isn't set up on this server yet (missing AI_API_KEY)." : "AI isn't available.");
  }
  return { chat };
}

/** Streams one action as NDJSON lines (AiEvent). Aborting `signal` cancels the upstream request. */
export function streamAi(body: AiRequest, chat: ReturnType<typeof buildChatMessages> | null, signal: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AiEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        const run = aiClient().messages.stream(
          {
            model: aiModel(),
            max_tokens: chat ? 2000 : maxTokensFor(body),
            // The frozen system prompt (plus anything the proxy prepends) is identical across requests: cache it.
            cache_control: { type: "ephemeral" },
            system: chat ? CHAT_SYSTEM : SYSTEM,
            messages: chat ?? [{ role: "user", content: buildUserMessage(body) }],
          },
          { signal },
        );
        for await (const event of run) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ t: "delta", v: event.delta.text });
        }
        const final = await run.finalMessage();
        const u = final.usage;
        log("ai.done", { action: body.action, input: u.input_tokens, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, output: u.output_tokens, stop: final.stop_reason });
        send({ t: "done", usage: { input: u.input_tokens, output: u.output_tokens }, cut: final.stop_reason === "max_tokens" });
      } catch (err) {
        const message = explain(err);
        if (message) {
          log("ai.failed", { action: body.action, error: err instanceof Error ? err.message.split("\n")[0] : String(err) }, "warn");
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
}
