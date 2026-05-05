/**
 * Error thrown by `SmartKartClient` for both:
 *   - non-2xx HTTP responses, and
 *   - 2xx responses where the API envelope reports `success: false`.
 *
 * Inspect `status`, `apiDescription`, and `apiErrors` to distinguish cases.
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
