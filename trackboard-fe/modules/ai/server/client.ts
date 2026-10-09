import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/* The only place that reads the AI credentials. `server-only` makes any browser import a build error. */

export const AI_MODEL = process.env.AI_MODEL?.trim() || "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;

export function aiClient(): Anthropic {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) throw new AiConfigError("AI_API_KEY is not set on the server");
  client ??= new Anthropic({
    apiKey,
    // Anthropic-compatible proxy; the SDK appends /v1/messages.
    baseURL: process.env.AI_BASE_URL?.trim() || undefined,
    maxRetries: 2,
    timeout: 60_000,
  });
  return client;
}

export class AiConfigError extends Error {}
