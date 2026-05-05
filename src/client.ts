import { SmartKartApiError } from "./errors.js";
import type {
  ApiResponse,
  CreatePhoneOrderData,
  CreatePhoneOrderRequest,
  GetCustomersRequest,
  GetItemsRequest,
  Item,
  Customer,
  PaginatedData,
} from "./types/index.js";

/** Default base URL — note the typo ("Connectros") matches the official docs. */
export const DEFAULT_BASE_URL = "http://rdtapi.com/RDTConnectrosAPI";

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
   */
  async getItems(
    request: GetItemsRequest | Omit<GetItemsRequest, "itemsFilter"> & {
      itemsFilter: Omit<GetItemsRequest["itemsFilter"], "storeID"> & { storeID?: number };
    },
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
    );
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Phone orders
  // ---------------------------------------------------------------------------

  /**
   * Create a phone order. Returns just the `phoneOrderNo` from the API
   * envelope on success.
   *
   * `storeID` falls back to `defaultStoreId` if not provided.
   */
  async createPhoneOrder(
    request:
      | CreatePhoneOrderRequest
      | (Omit<CreatePhoneOrderRequest, "storeID"> & { storeID?: number }),
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
    );
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------------

  /** Fetch a paginated list of customers with optional filters. */
  async getCustomers(request: GetCustomersRequest): Promise<PaginatedData<Customer>> {
    const res = await this.post<ApiResponse<PaginatedData<Customer>>>(
      this.endpoints.getCustomers,
      request,
    );
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Lower-level POST helper. Exposed for forward-compatibility if SmartKart
   * adds an endpoint that isn't wrapped here yet.
   *
   * Throws `SmartKartApiError` on non-2xx responses or `success: false`.
   */
  async post<T extends ApiResponse<unknown>>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

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
      });
    } catch (cause) {
      throw new SmartKartApiError({
        message: `SmartKart API network error calling ${path}: ${(cause as Error)?.message ?? cause}`,
        status: 0,
        endpoint: path,
      });
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
