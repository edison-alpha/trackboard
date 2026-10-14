import { log } from "./log.ts";

/** No valid session cookie. 401. */
export class AuthError extends Error {}
/** Bad input from the client. 400. */
export class InputError extends Error {}
/** The thing does not exist or the viewer may not see it. 404. */
export class NotFoundError extends Error {}
/** The person is known but may not do this (a viewer editing, a member changing roles). 403. */
export class ForbiddenError extends Error {}
/** The request clashes with what exists (an id already taken, an invite already used). 409. */
export class ConflictError extends Error {}
/** The upload or request is larger than allowed. 413. */
export class TooLargeError extends Error {}

/** Too many requests; `wait` is how many seconds until the next one is allowed. 429. */
export class RateLimitedError extends Error {
  constructor(public readonly wait: number) {
    super(`Too many AI requests. Try again in ${wait} seconds.`);
  }
}
/** A feature this server is not configured for (Google sign-in, AI). 503. */
export class UnavailableError extends Error {}

type Known = { status: number; message: string; headers?: Record<string, string> };

/** Failures with a known cause get a specific status and a message the user can act on. */
export function classify(error: unknown): Known | undefined {
  if (error instanceof AuthError) return { status: 401, message: error.message };
  if (error instanceof InputError) return { status: 400, message: error.message };
  if (error instanceof NotFoundError) return { status: 404, message: error.message };
  if (error instanceof ForbiddenError) return { status: 403, message: error.message };
  if (error instanceof ConflictError) return { status: 409, message: error.message };
  if (error instanceof TooLargeError) return { status: 413, message: error.message };
  if (error instanceof RateLimitedError) return { status: 429, message: error.message, headers: { "retry-after": String(error.wait) } };
  if (error instanceof UnavailableError) return { status: 503, message: error.message };
  const e = error as { code?: string; message?: string };
  const message = e.message ?? "";
  if (e.code === "ECONNREFUSED" || e.code === "CONNECTION_ENDED" || e.code === "CONNECTION_CLOSED" || e.code === "57P01") {
    log("dependency.down", { dependency: "database", code: e.code, error: message.split("\n")[0] }, "error");
    return { status: 503, message: "Trackboard lost its database connection. Try again in a moment." };
  }
  return undefined;
}
