/**
 * SmartKart (RDT Connectors) API client.
 *
 * Usage in a Gadget app:
 *
 * 1. Drop this folder into `api/utilities/smartkart-api` (or publish it as
 *    a private package and add it to `package.json`).
 * 2. Add `SMARTKART_API_TOKEN` to Gadget's environment variables.
 * 3. Use it from an action or global action:
 *
 *    ```ts
 *    import { SmartKartClient } from "smartkart-api";
 *
 *    const sk = new SmartKartClient({
 *      token: process.env.SMARTKART_API_TOKEN!,
 *      defaultStoreId: 42,
 *    });
 *
 *    const { records } = await sk.getCustomers({
 *      pageSize: 50,
 *      pageNumber: 1,
 *      customerFilter: { customerNo: "(718)782-4608" },
 *    });
 *    ```
 */
export { SmartKartClient, DEFAULT_BASE_URL, ENDPOINTS } from "./client.js";
export type { SmartKartClientOptions, FetchLike } from "./client.js";
export { SmartKartApiError } from "./errors.js";
export * from "./types/index.js";
