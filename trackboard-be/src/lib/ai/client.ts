import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.ts";

/* The only place that reads the AI credentials. */

export class AiConfigError extends Error {}

let client: Anthropic | null = null;

export function aiClient(): Anthropic {
  const e = env();
  if (!e.aiApiKey) throw new AiConfigError("AI_API_KEY is not set on the server");
  client ??= new Anthropic({
    apiKey: e.aiApiKey,
    // Anthropic-compatible proxy; the SDK appends /v1/messages.
    baseURL: e.aiBaseUrl,
    maxRetries: 2,
    timeout: 60_000,
  });
  return client;
}

export const aiModel = () => env().aiModel;
