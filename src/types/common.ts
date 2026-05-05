/**
 * Generic envelope returned by every SmartKart endpoint.
 *
 * Note: the client unwraps this and returns `data` directly on success,
 * throwing `SmartKartApiError` on `success: false`. This type is exported
 * so callers can describe the raw API shape if they need it.
 */
export interface ApiResponse<TData> {
  success: boolean;
  description: string;
  errors: string[] | null;
  data: TData;
}

/**
 * Pagination wrapper used by list endpoints (Items, Customers, ...).
 */
export interface PaginatedData<TRecord> {
  totalRecords: number;
  recordsFiltered: number;
  pageSize: number;
  currentPage: number;
  records: TRecord[];
}

/**
 * Common pagination input. Specific request types extend this with their
 * own filter object (`itemsFilter`, `customerFilter`, ...).
 */
export interface PaginatedRequestBase {
  pageSize: number;
  pageNumber: number;
}

/**
 * ISO-8601 date-time string, e.g. "2025-05-06T15:00:00".
 *
 * The API accepts and emits naive (no timezone) ISO strings. Branding it
 * to `string` keeps callers honest without forcing a Date wrapper.
 */
export type IsoDateTime = string;
