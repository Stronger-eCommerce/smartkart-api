import { SmartKartApiError } from "./errors.js";
import type {
  Logger,
  PaginationOptions,
  RequestOptions,
  RetryOptions,
} from "./request-options.js";
import type {
  ApiResponse,
  CreatePhoneOrderData,
  CreatePhoneOrderInput,
  CreatePhoneOrderRequest,
  Customer,
  CustomerFilter,
  GetCustomersRequest,
  GetItemsInput,
  GetItemsRequest,
  Item,
  ItemsFilterInput,
  PaginatedData,
} from "./types/index.js";

/** Default base URL — note the typo ("Connectros") matches the official docs. */
export const DEFAULT_BASE_URL = "http://rdtapi.com/RDTConnectrosAPI";

/** Default request timeout (30 seconds). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default page size for pagination iterators. */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Endpoint paths, kept here so callers can tweak/override them if SmartKart
 * publishes a new path without us shipping a new version.
 */
export const ENDPOINTS = {
  getItems: "/api/OpenAPI/GetItems",
  createPhoneOrder: "/api/OpenAPI/CreatePhoneOrder",
  getCustomers: "/api/Customers/GetCustomers",
} as const;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SmartKartClientOptions {
  /** Your assigned API token. Sent as the `Token` header on every request. */
  token: string;
  /**
   * Base URL of the API.
   * @default "http://rdtapi.com/RDTConnectrosAPI"
   */
  baseUrl?: string;
  /**
   * Custom fetch implementation. Defaults to `globalThis.fetch`.
   * Useful for tests, retry wrappers, or running on Node < 18.
   */
  fetch?: FetchLike;
  /**
   * Optional default storeID. When set, it's used as a fallback for any
   * request that doesn't explicitly include one.
   */
  defaultStoreId?: number;
  /**
   * Override individual endpoint paths. Merged with {@link ENDPOINTS}.
   */
  endpoints?: Partial<typeof ENDPOINTS>;
  /**
   * Extra headers to attach to every request (e.g., for tracing).
   */
  defaultHeaders?: Record<string, string>;
  /**
   * Default per-request timeout in milliseconds. Pass `0` to disable.
   * @default 30000
   */
  defaultTimeoutMs?: number;
  /**
   * Default retry policy for transient failures. Set to `false` to disable
   * retries entirely. By default, retries up to 3 attempts on network
   * errors, 408, 425, 429, and 5xx responses with exponential backoff.
   */
  retry?: RetryOptions | false;
  /**
   * Optional logger for debug/warn output (request URLs, retry attempts,
   * timeout fires, etc.). Compatible with `console` and `pino`.
   */
  logger?: Logger;
}

const DEFAULT_RETRY: Required<Omit<RetryOptions, "retryOn">> = {
  attempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5_000,
};

/**
 * Default retry predicate: retry network errors (status 0) and the usual
 * transient HTTP conditions.
 */
function defaultRetryOn(info: { status: number }): boolean {
  const { status } = info;
  return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Thin, typed client for the SmartKart (RDT Connectors) API.
 *
 * Each method returns the unwrapped `data` payload from the SmartKart
 * envelope. Errors — whether HTTP-level or `success: false` from the API —
 * are thrown as {@link SmartKartApiError}.
 *
 * @example
 * ```ts
 * const sk = new SmartKartClient({
 *   token: process.env.SMARTKART_API_TOKEN!,
 *   defaultStoreId: 42,
 * });
 *
 * const items = await sk.getItems({
 *   pageSize: 30,
 *   pageNumber: 1,
 *   itemsFilter: { itemStatus: "Active" },
 * });
 * ```
 */
export class SmartKartClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly defaultStoreId?: number;
  private readonly endpoints: typeof ENDPOINTS;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeoutMs: number;
  private readonly defaultRetry: RetryOptions | false;
  private readonly logger?: Logger;

  constructor(options: SmartKartClientOptions) {
    if (!options.token) {
      throw new Error("SmartKartClient: 'token' is required");
    }

    const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!fetchImpl) {
      throw new Error(
        "SmartKartClient: no fetch implementation found. Pass one via `options.fetch` " +
          "or run on a platform with global fetch (Node 18+, modern browsers, Gadget).",
      );
    }

    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
    this.defaultStoreId = options.defaultStoreId;
    this.endpoints = { ...ENDPOINTS, ...(options.endpoints ?? {}) };
    this.defaultHeaders = { ...(options.defaultHeaders ?? {}) };
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultRetry = options.retry ?? {};
    this.logger = options.logger;
  }

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------

  /**
   * Fetch a paginated list of items.
   *
   * `itemsFilter.storeID` falls back to `defaultStoreId` if not provided.
   *
   * Per the SmartKart changelog, leaving `itemStatus` as `null` (or omitted)
   * loads ALL items — pass `"Active"` or `"Inactive"` to narrow.
   *
   * @throws {SmartKartApiError} on HTTP failure, `success: false`, network
   *   errors, or timeouts.
   *
   * @example
   * ```ts
   * const page = await sk.getItems({
   *   pageSize: 50,
   *   pageNumber: 1,
   *   itemsFilter: { itemStatus: "Active" },
   * }, { timeoutMs: 60_000 });
   * ```
   */
  async getItems(
    request: GetItemsInput,
    options?: RequestOptions,
  ): Promise<PaginatedData<Item>> {
    const storeID = request.itemsFilter.storeID ?? this.defaultStoreId;
    if (storeID === undefined) {
      throw new Error(
        "SmartKartClient.getItems: storeID is required. Pass it on `itemsFilter.storeID` " +
          "or set `defaultStoreId` on the client.",
      );
    }

    const body: GetItemsRequest = {
      pageSize: request.pageSize,
      pageNumber: request.pageNumber,
      itemsFilter: { ...request.itemsFilter, storeID },
    };

    const res = await this.post<ApiResponse<PaginatedData<Item>>>(
      this.endpoints.getItems,
      body,
      options,
    );
    return res.data;
  }

  /**
   * Stream every item matching `filter` across pages, yielding records one
   * at a time. Handles pagination automatically; stops once a short page
   * (or `maxPages`) is reached.
   *
   * @example
   * ```ts
   * for await (const item of sk.getAllItems({ itemStatus: "Active" })) {
   *   console.log(item.itemID);
   * }
   * ```
   */
  async *getAllItems(
    filter: ItemsFilterInput = {},
    options?: PaginationOptions & RequestOptions,
  ): AsyncIterableIterator<Item> {
    const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
    const startPage = options?.startPage ?? 1;
    const maxPages = options?.maxPages;
    const requestOpts: RequestOptions = {
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
      retry: options?.retry,
      logger: options?.logger,
    };

    for (let page = startPage; ; page++) {
      if (maxPages !== undefined && page - startPage >= maxPages) return;

      const result = await this.getItems(
        { pageSize, pageNumber: page, itemsFilter: filter },
        requestOpts,
      );
      for (const record of result.records) {
        yield record;
      }
      if (result.records.length < pageSize) return;
    }
  }

  // ---------------------------------------------------------------------------
  // Phone orders
  // ---------------------------------------------------------------------------

  /**
   * Create a phone order. Returns just the `phoneOrderNo` from the API
   * envelope on success.
   *
   * `storeID` falls back to `defaultStoreId` if not provided.
   *
   * Note: the API expects **PascalCase** keys on `CustomerShippingAddress`
   * (`Address1`, `Phone1`, ...) but **camelCase** on `address`. The types
   * preserve that distinction — don't mix them.
   *
   * @throws {SmartKartApiError} on HTTP failure or `success: false`.
   *
   * @example
   * ```ts
   * const { phoneOrderNo } = await sk.createPhoneOrder({
   *   customerNo: "(123)456-7890",
   *   firstName: "John",
   *   lastName: "Doe",
   *   address: { phone1: "(718)782-4608" },
   *   phoneOrderType: "MyApp",
   *   orderDetails: [
   *     { barCode: "0376", qty: 2, uomType: UomType.Standard, sortOrder: 1 },
   *   ],
   * });
   * ```
   */
  async createPhoneOrder(
    request: CreatePhoneOrderInput,
    options?: RequestOptions,
  ): Promise<CreatePhoneOrderData> {
    const storeID = request.storeID ?? this.defaultStoreId;
    if (storeID === undefined) {
      throw new Error(
        "SmartKartClient.createPhoneOrder: storeID is required. Pass it on the request " +
          "or set `defaultStoreId` on the client.",
      );
    }

    const body: CreatePhoneOrderRequest = { ...request, storeID } as CreatePhoneOrderRequest;

    const res = await this.post<ApiResponse<CreatePhoneOrderData>>(
      this.endpoints.createPhoneOrder,
      body,
      options,
    );
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------------

  /**
   * Fetch a paginated list of customers with optional filters.
   *
   * @throws {SmartKartApiError} on HTTP failure or `success: false`.
   *
   * @example
   * ```ts
   * const { records } = await sk.getCustomers({
   *   pageSize: 50,
   *   pageNumber: 1,
   *   customerFilter: { customerNo: "(718)782-4608" },
   * });
   * ```
   */
  async getCustomers(
    request: GetCustomersRequest,
    options?: RequestOptions,
  ): Promise<PaginatedData<Customer>> {
    const res = await this.post<ApiResponse<PaginatedData<Customer>>>(
      this.endpoints.getCustomers,
      request,
      options,
    );
    return res.data;
  }

  /**
   * Stream every customer matching `filter` across pages.
   *
   * @example
   * ```ts
   * for await (const c of sk.getAllCustomers({ lastName: "Doe" })) {
   *   console.log(c.customerNo);
   * }
   * ```
   */
  async *getAllCustomers(
    filter: CustomerFilter = {},
    options?: PaginationOptions & RequestOptions,
  ): AsyncIterableIterator<Customer> {
    const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
    const startPage = options?.startPage ?? 1;
    const maxPages = options?.maxPages;
    const requestOpts: RequestOptions = {
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
      retry: options?.retry,
      logger: options?.logger,
    };

    for (let page = startPage; ; page++) {
      if (maxPages !== undefined && page - startPage >= maxPages) return;

      const result = await this.getCustomers(
        { pageSize, pageNumber: page, customerFilter: filter },
        requestOpts,
      );
      for (const record of result.records) {
        yield record;
      }
      if (result.records.length < pageSize) return;
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Lower-level POST helper. Exposed for forward-compatibility if SmartKart
   * adds an endpoint that isn't wrapped here yet.
   *
   * Honours `signal`, `timeoutMs`, and `retry` from {@link RequestOptions}.
   * Throws `SmartKartApiError` on non-2xx responses or `success: false`.
   */
  async post<T extends ApiResponse<unknown>>(
    path: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const logger = options?.logger ?? this.logger;

    const retryConfig = this.resolveRetry(options?.retry);
    const totalAttempts = retryConfig === false ? 1 : retryConfig.attempts ?? DEFAULT_RETRY.attempts;
    const retryOn =
      retryConfig === false ? () => false : retryConfig.retryOn ?? defaultRetryOn;

    let lastError: unknown;
    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      // Honor caller cancellation between attempts.
      if (options?.signal?.aborted) {
        throw options.signal.reason ?? new Error("SmartKartClient: request aborted");
      }

      try {
        const result = await this.executeRequest<T>(url, path, body, options, logger);
        if (attempt > 1) {
          logger?.debug?.("smartkart request succeeded after retry", { path, attempt });
        }
        return result;
      } catch (err) {
        lastError = err;

        const status = err instanceof SmartKartApiError ? err.status : -1;
        const isLastAttempt = attempt === totalAttempts;
        const aborted = options?.signal?.aborted === true;

        if (isLastAttempt || aborted || !retryOn({ status, attempt, error: err })) {
          throw err;
        }

        const delayMs = computeBackoff(attempt, retryConfig === false ? DEFAULT_RETRY : retryConfig);
        logger?.warn?.("smartkart request failed, retrying", {
          path,
          attempt,
          totalAttempts,
          status,
          delayMs,
        });
        await sleep(delayMs, options?.signal);
      }
    }

    // Unreachable under normal control flow, but keeps TS happy.
    throw lastError ?? new Error("SmartKartClient: retry loop exited unexpectedly");
  }

  private resolveRetry(perRequest: RequestOptions["retry"]): RetryOptions | false {
    if (perRequest === false) return false;
    if (this.defaultRetry === false && perRequest === undefined) return false;
    const base = this.defaultRetry === false ? {} : this.defaultRetry;
    return { ...base, ...(perRequest ?? {}) };
  }

  private async executeRequest<T extends ApiResponse<unknown>>(
    url: string,
    path: string,
    body: unknown,
    options: RequestOptions | undefined,
    logger: Logger | undefined,
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const { signal, cleanup, didTimeout } = mergeSignals(options?.signal, timeoutMs);

    logger?.debug?.("smartkart request", { path, timeoutMs });

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          ...this.defaultHeaders,
          Token: this.token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      const timedOut = didTimeout();
      throw new SmartKartApiError({
        message: timedOut
          ? `SmartKart API request timed out after ${timeoutMs}ms (${path})`
          : `SmartKart API network error calling ${path}: ${(cause as Error)?.message ?? cause}`,
        status: 0,
        endpoint: path,
      });
    } finally {
      cleanup();
    }

    const rawText = await response.text();
    let parsed: unknown = undefined;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = rawText;
      }
    }

    if (!response.ok) {
      const envelope = isApiResponse(parsed) ? parsed : undefined;
      throw new SmartKartApiError({
        message: `SmartKart API request failed: ${response.status} ${response.statusText} (${path})`,
        status: response.status,
        endpoint: path,
        apiDescription: envelope?.description,
        apiErrors: envelope?.errors,
        rawBody: parsed,
      });
    }

    if (!isApiResponse(parsed)) {
      throw new SmartKartApiError({
        message: `SmartKart API returned a non-envelope response from ${path}`,
        status: response.status,
        endpoint: path,
        rawBody: parsed,
      });
    }

    if (parsed.success === false) {
      throw new SmartKartApiError({
        message: `SmartKart API error from ${path}: ${parsed.description ?? "unknown error"}`,
        status: response.status,
        endpoint: path,
        apiDescription: parsed.description,
        apiErrors: parsed.errors,
        rawBody: parsed,
      });
    }

    return parsed as T;
  }
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as { success: unknown }).success === "boolean"
  );
}

function computeBackoff(
  attempt: number,
  retry: RetryOptions,
): number {
  const base = retry.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs;
  const max = retry.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs;
  const exp = base * 2 ** (attempt - 1);
  const jitter = Math.random() * base;
  return Math.min(max, Math.floor(exp + jitter));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Merge a caller-provided signal with an internal timeout, returning a
 * single composite signal plus a cleanup function and a `didTimeout()`
 * helper used to format better error messages.
 *
 * Avoids `AbortSignal.any` so this works on every Node 18+ runtime.
 */
function mergeSignals(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; didTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (external?.aborted) {
    controller.abort(external.reason);
  }

  const onExternalAbort = () => {
    controller.abort(external?.reason);
  };
  external?.addEventListener("abort", onExternalAbort);

  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`SmartKartClient: request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer !== undefined) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
    didTimeout: () => timedOut,
  };
}
