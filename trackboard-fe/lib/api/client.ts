import { API_URL } from "@/lib/env";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Listener = () => void;
const unauthorized = new Set<Listener>();

/** Called when the server says the session is gone, so the app can go back to the sign-in screen. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorized.add(listener);
  return () => void unauthorized.delete(listener);
}

type Init = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

/** The fetch every call to trackboard-be goes through: cookies on, JSON in and out, errors with a message to show. */
export async function apiFetch(path: string, init: Init = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"),
      credentials: "include",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      signal: init.signal ?? null,
    });
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }
  if (res.status === 401) unauthorized.forEach((l) => l());
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `The request failed (${res.status}).`, res.status);
  }
  return res;
}

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  return (await apiFetch(path, init)).json() as Promise<T>;
}
