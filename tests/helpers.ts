import { vi } from "vitest";
import type { FetchLike } from "../src/index.js";

export interface MockResponse {
  status?: number;
  statusText?: string;
  body: unknown;
  delayMs?: number;
}

/**
 * Build a `FetchLike` that returns a queued sequence of responses.
 * Throws if called more times than the queue length.
 */
export function fetchQueue(responses: MockResponse[]): {
  fetch: FetchLike;
  calls: Array<{ url: string; init: RequestInit | undefined }>;
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let i = 0;

  const fetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const next = responses[i++];
    if (!next) {
      throw new Error(`fetchQueue: unexpected call #${i} to ${url}`);
    }
    if (next.delayMs) {
      await new Promise((r) => setTimeout(r, next.delayMs));
    }
    if (init?.signal?.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    const body = typeof next.body === "string" ? next.body : JSON.stringify(next.body);
    return new Response(body, {
      status: next.status ?? 200,
      statusText: next.statusText ?? "OK",
      headers: { "Content-Type": "application/json" },
    });
  });

  return { fetch: fetch as unknown as FetchLike, calls };
}

/**
 * A `FetchLike` that throws a network error every call.
 */
export function fetchAlwaysError(message = "network down"): FetchLike {
  return vi.fn(async () => {
    throw new TypeError(message);
  }) as unknown as FetchLike;
}

/** Build a successful API envelope. */
export function envelope<T>(data: T) {
  return { success: true, description: "", errors: null, data };
}

/** Build a failure API envelope. */
export function failureEnvelope(description: string, errors: string[] = []) {
  return { success: false, description, errors, data: null };
}
