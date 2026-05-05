/**
 * Error thrown by `SmartKartClient` for both:
 *   - non-2xx HTTP responses,
 *   - 2xx responses where the API envelope reports `success: false`, and
 *   - network errors / timeouts (where `status === 0`).
 *
 * Inspect `status`, `apiDescription`, and `apiErrors` to distinguish cases.
 *
 * @example
 * ```ts
 * try {
 *   await sk.getItems({ pageSize: 30, pageNumber: 1, itemsFilter: {} });
 * } catch (err) {
 *   if (isSmartKartApiError(err)) {
 *     if (err.status === 0) {
 *       // network error or timeout
 *     } else if (err.status >= 500) {
 *       // server error
 *     } else {
 *       console.error(err.endpoint, err.apiDescription, err.apiErrors);
 *     }
 *   }
 * }
 * ```
 */
export class SmartKartApiError extends Error {
  /** HTTP status code (e.g. 200 when the API returned `success: false` with 200, 401, 500, ...). */
  public readonly status: number;
  /** Endpoint path that produced the error, e.g. "/api/OpenAPI/GetItems". */
  public readonly endpoint: string;
  /** The `description` field from the API envelope, when available. */
  public readonly apiDescription?: string;
  /** The `errors` array from the API envelope, when available. */
  public readonly apiErrors?: unknown;
  /** Raw response body — JSON when parseable, otherwise the text. */
  public readonly rawBody?: unknown;

  constructor(options: {
    message: string;
    status: number;
    endpoint: string;
    apiDescription?: string;
    apiErrors?: unknown;
    rawBody?: unknown;
  }) {
    super(options.message);
    this.name = "SmartKartApiError";
    this.status = options.status;
    this.endpoint = options.endpoint;
    this.apiDescription = options.apiDescription;
    this.apiErrors = options.apiErrors;
    this.rawBody = options.rawBody;
  }
}

/**
 * Cross-realm safe `instanceof` replacement for {@link SmartKartApiError}.
 *
 * Use this in consumer code instead of `err instanceof SmartKartApiError`
 * when the error might cross module boundaries (e.g. dual ESM/CJS package
 * graphs, Jest module mocking, or workers), where `instanceof` can yield
 * false negatives.
 *
 * @example
 * ```ts
 * import { isSmartKartApiError } from "@stronger-ecommerce/smartkart-api";
 *
 * try {
 *   await sk.getItems({ ... });
 * } catch (err) {
 *   if (isSmartKartApiError(err)) {
 *     console.error(err.endpoint, err.status, err.apiDescription);
 *   } else {
 *     throw err;
 *   }
 * }
 * ```
 */
export function isSmartKartApiError(value: unknown): value is SmartKartApiError {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { name?: unknown; status?: unknown; endpoint?: unknown };
  return (
    v.name === "SmartKartApiError" &&
    typeof v.status === "number" &&
    typeof v.endpoint === "string"
  );
}
