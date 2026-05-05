/**
 * Shared runtime options used by both the client constructor (as defaults)
 * and individual request methods (as per-call overrides).
 */

/**
 * Optional logger hook. Methods are individually optional so a partial
 * implementation (e.g. just `debug`) is acceptable.
 *
 * Compatible with `console`, `pino`, and most structured loggers.
 */
export interface Logger {
  debug?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * Retry behaviour for transient failures. Pass `false` (on the client or
 * a single request) to disable retries entirely.
 */
export interface RetryOptions {
  /**
   * Total number of attempts (including the initial one).
   * @default 3
   */
  attempts?: number;
  /**
   * Base delay in milliseconds for exponential backoff. The actual delay
   * is `baseDelayMs * 2^(attempt - 1)` plus jitter, capped at `maxDelayMs`.
   * @default 250
   */
  baseDelayMs?: number;
  /**
   * Maximum delay in milliseconds between retries.
   * @default 5000
   */
  maxDelayMs?: number;
  /**
   * Custom predicate. Returning `true` retries the request. The default
   * retries on network errors (status 0), 408, 425, 429, and 5xx.
   */
  retryOn?: (info: { status: number; attempt: number; error: unknown }) => boolean;
}

/**
 * Per-request options accepted as the optional last argument on every
 * client method.
 */
export interface RequestOptions {
  /**
   * AbortSignal from the caller. Aborting it cancels the in-flight fetch
   * (and any pending retry). Honoured immediately if already aborted.
   */
  signal?: AbortSignal;
  /**
   * Per-request timeout in milliseconds. Overrides the client default.
   * Pass `0` to disable the timeout for this request only.
   */
  timeoutMs?: number;
  /**
   * Per-request retry override. Pass `false` to disable retries for this
   * request, or a partial config to override individual fields.
   */
  retry?: RetryOptions | false;
  /**
   * Per-request logger override.
   */
  logger?: Logger;
}

/**
 * Options for the streaming pagination helpers (`getAllItems`,
 * `getAllCustomers`). Composes with {@link RequestOptions}.
 */
export interface PaginationOptions {
  /**
   * Items per page sent to the API. Larger pages mean fewer round-trips.
   * @default 100
   */
  pageSize?: number;
  /**
   * Page number to start streaming from.
   * @default 1
   */
  startPage?: number;
  /**
   * Optional safety cap on the number of pages to fetch.
   */
  maxPages?: number;
}
