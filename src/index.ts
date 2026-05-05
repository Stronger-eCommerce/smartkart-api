/**
 * SmartKart (RDT Connectors) API client.
 *
 * @example
 * ```ts
 * import { SmartKartClient } from "@stronger-ecommerce/smartkart-api";
 *
 * const sk = new SmartKartClient({
 *   token: process.env.SMARTKART_API_TOKEN!,
 *   defaultStoreId: 42,
 * });
 *
 * const { records } = await sk.getCustomers({
 *   pageSize: 50,
 *   pageNumber: 1,
 *   customerFilter: { customerNo: "(718)782-4608" },
 * });
 * ```
 */
export {
  SmartKartClient,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_PAGE_SIZE,
  ENDPOINTS,
} from "./client.js";
export type { SmartKartClientOptions, FetchLike } from "./client.js";
export { SmartKartApiError, isSmartKartApiError } from "./errors.js";
export type {
  Logger,
  PaginationOptions,
  RequestOptions,
  RetryOptions,
} from "./request-options.js";
export * from "./types/index.js";
