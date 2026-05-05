import type { ApiResponse, IsoDateTime, PaginatedData, PaginatedRequestBase } from "./common.js";

/**
 * Item lifecycle status.
 *
 * Per the changelog: leaving `itemStatus` as `null` (or omitting it) loads
 * all items. Explicitly pass `"Active"` or `"Inactive"` to filter.
 */
export type ItemStatus = "Active" | "Inactive";

export interface ItemsFilter {
  /** Store ID assigned to you by the SmartKart office. Required. */
  storeID: number;
  itemID?: string | null;
  name?: string | null;
  description?: string | null;
  modelNumber?: string | null;
  upc?: string | null;
  itemType?: string | null;
  /**
   * `"Active"` | `"Inactive"` | `null`.
   * `null` or blank loads all items (faster than the previous default).
   */
  itemStatus?: ItemStatus | null;
  /** ISO-8601 timestamp; returns items modified on/after this instant. */
  lastDateModified?: IsoDateTime | null;
}

export interface GetItemsRequest extends PaginatedRequestBase {
  itemsFilter: ItemsFilter;
}

/**
 * Item custom field as returned by the API. The exact shape isn't fully
 * documented; we model the most likely fields and keep an index signature
 * so unknown fields are surfaced rather than silently dropped.
 */
export interface ItemCustomField {
  name?: string;
  value?: unknown;
  [key: string]: unknown;
}

/**
 * Item record returned by `GetItems`.
 *
 * The public docs only enumerate filterable fields plus the recently added
 * `parent` and `customFields`. The index signature preserves any other
 * fields the API returns so they aren't silently lost in TypeScript.
 */
export interface Item {
  itemID: string;
  name?: string;
  description?: string;
  modelNumber?: string;
  upc?: string;
  itemType?: string;
  itemStatus?: ItemStatus | null;
  lastDateModified?: IsoDateTime;
  /** Parent item reference (added in recent Backoffice versions). */
  parent?: string | null;
  /** Custom fields (added in recent Backoffice versions). */
  customFields?: ItemCustomField[] | Record<string, unknown> | null;
  /** Forward-compatible: any other fields returned by the API. */
  [key: string]: unknown;
}

export type GetItemsResponse = ApiResponse<PaginatedData<Item>>;
