# @stronger-ecommerce/smartkart-api

Typed TypeScript client for the [SmartKart](https://smartkartpos.com) (RDT Connectors) point-of-sale API.

[![npm](https://img.shields.io/npm/v/@stronger-ecommerce/smartkart-api.svg)](https://www.npmjs.com/package/@stronger-ecommerce/smartkart-api)

Wraps the three currently-published endpoints, with timeouts, retry-with-backoff, `AbortSignal` cancellation, pagination iterators, and rich error reporting:

| Method                              | Endpoint                             | Description                          |
| ----------------------------------- | ------------------------------------ | ------------------------------------ |
| `getItems` / `getAllItems`          | `POST /api/OpenAPI/GetItems`         | Paginated item list with filters     |
| `createPhoneOrder`                  | `POST /api/OpenAPI/CreatePhoneOrder` | Create a phone order                 |
| `getCustomers` / `getAllCustomers`  | `POST /api/Customers/GetCustomers`   | Paginated customer list with filters |

## Install

```bash
npm install @stronger-ecommerce/smartkart-api
# or
pnpm add @stronger-ecommerce/smartkart-api
# or
yarn add @stronger-ecommerce/smartkart-api
```

Requires Node 18+ (or any runtime with global `fetch` — modern browsers, Bun, Gadget, Cloudflare Workers, ...). On older Node, pass a polyfill via `options.fetch`.

## Quick start

```ts
import { SmartKartClient, isSmartKartApiError, UomType } from "@stronger-ecommerce/smartkart-api";

const sk = new SmartKartClient({
  token: process.env.SMARTKART_API_TOKEN!, // sent as the `Token` header
  defaultStoreId: 42,                      // optional, fills in storeID where applicable
});

const { records } = await sk.getItems({
  pageSize: 30,
  pageNumber: 1,
  itemsFilter: { itemStatus: "Active" },
});
```

## Configuration

```ts
new SmartKartClient({
  token,                                   // required
  baseUrl,                                 // default: "http://rdtapi.com/RDTConnectrosAPI"
  defaultStoreId,                          // optional fallback storeID
  fetch,                                   // optional custom fetch (defaults to globalThis.fetch)
  endpoints: { getItems: "..." },          // override individual endpoint paths
  defaultHeaders: { "X-Trace": "abc" },    // attached to every request
  defaultTimeoutMs: 30_000,                // default 30s; 0 disables
  retry: { attempts: 3, baseDelayMs: 250 },// or `false` to disable retries entirely
  logger: { debug, warn },                 // optional; compatible with console / pino
});
```

Every method also accepts an optional `RequestOptions` last argument:

```ts
await sk.getItems(req, {
  signal: ac.signal,
  timeoutMs: 60_000,
  retry: false,
  logger: { debug: console.debug, warn: console.warn },
});
```

## Endpoints

### `getItems(input, options?) → PaginatedData<Item>`

```ts
const page = await sk.getItems({
  pageSize: 100,
  pageNumber: 1,
  itemsFilter: {
    // storeID omitted -> uses defaultStoreId
    itemStatus: "Active",                     // "Active" | "Inactive" | null (= all)
    lastDateModified: "2026-01-01T00:00:00",
  },
});
```

`Item` has explicit fields for everything documented (`itemID`, `name`, `upc`, `parent`, `customFields`, ...) plus an index signature so any extra fields the API returns aren't silently dropped.

### `getAllItems(filter?, options?) → AsyncIterableIterator<Item>`

Streams every matching item across pages — handles the page loop and stops on the short final page or `maxPages`.

```ts
for await (const item of sk.getAllItems({ itemStatus: "Active" }, { pageSize: 200 })) {
  console.log(item.itemID);
}
```

### `createPhoneOrder(input, options?) → { phoneOrderNo }`

```ts
const { phoneOrderNo } = await sk.createPhoneOrder({
  customerNo: "(123)456-7890",
  firstName: "John",
  lastName: "Doe",
  address: { phone1: "(718)782-4608" },
  CustomerShippingAddress: [
    { Address1: "1234 5th ave", City: "Brooklyn", State: "NY", ZipCode: "11201" },
  ],
  phoneOrderType: "YourAppName",
  TakenBy: "jdoe",
  Shift: "Day",
  tenderName: "YourAppName",
  orderDetails: [
    { barCode: "0376", qty: 2, uomType: UomType.Standard, sortOrder: 1 },
    { barCode: "894792002959", qty: 1, uomType: UomType.Case, sortOrder: 2 },
  ],
});
```

Note the API expects **PascalCase** keys on `CustomerShippingAddress` (`Address1`, `Phone1`, ...) but **camelCase** on `address`. The types preserve that exactly so the wire payload is correct.

### `getCustomers(input, options?) → PaginatedData<Customer>`

```ts
const page = await sk.getCustomers({
  pageSize: 50,
  pageNumber: 1,
  customerFilter: { customerNo: "(718)782-4608" },
});
```

### `getAllCustomers(filter?, options?) → AsyncIterableIterator<Customer>`

```ts
for await (const c of sk.getAllCustomers({ lastName: "Doe" })) {
  console.log(c.customerNo);
}
```

## Cancellation and timeouts

```ts
const ac = new AbortController();
setTimeout(() => ac.abort("user cancelled"), 5_000);

await sk.getItems(req, { signal: ac.signal, timeoutMs: 60_000 });
```

The default timeout is 30 seconds. Pass `timeoutMs: 0` to disable for a single request. Aborting between retry attempts is honoured.

## Retry

By default, the client retries up to **3 attempts** with exponential backoff on:

- Network errors / timeouts (`status === 0`)
- HTTP `408`, `425`, `429`
- Any HTTP `5xx`

Disable per-request with `retry: false`, or override:

```ts
const sk = new SmartKartClient({
  token,
  retry: { attempts: 5, baseDelayMs: 500, maxDelayMs: 10_000 },
});

await sk.getItems(req, { retry: false }); // disable for this call
```

## Error handling

Both HTTP failures and `success: false` envelopes throw a `SmartKartApiError`:

```ts
import { isSmartKartApiError } from "@stronger-ecommerce/smartkart-api";

try {
  await sk.getItems({ pageSize: 30, pageNumber: 1, itemsFilter: {} });
} catch (err) {
  if (isSmartKartApiError(err)) {
    console.error(err.endpoint, err.status, err.apiDescription, err.apiErrors);
  } else {
    throw err;
  }
}
```

Use `isSmartKartApiError(err)` instead of `err instanceof SmartKartApiError` — `instanceof` can fail across dual ESM/CJS module graphs and worker boundaries. Fields: `status`, `endpoint`, `apiDescription`, `apiErrors`, `rawBody`. `status === 0` indicates a network error or timeout.

On success, methods return the unwrapped `data` payload — you don't need to check `.success` yourself.

## Use in a Gadget app

1. Install: `npm install @stronger-ecommerce/smartkart-api`.
2. Add `SMARTKART_API_TOKEN` (and optionally `SMARTKART_STORE_ID`) to Gadget's environment variables.
3. From an action:

```ts
// api/actions/syncItems.ts
import { SmartKartClient } from "@stronger-ecommerce/smartkart-api";

export const run = async ({ logger }) => {
  const sk = new SmartKartClient({
    token: process.env.SMARTKART_API_TOKEN!,
    defaultStoreId: Number(process.env.SMARTKART_STORE_ID),
    logger,
  });

  for await (const item of sk.getAllItems({ itemStatus: "Active" })) {
    // upsert into a Gadget model...
  }
};
```

## Runtime validation with Zod

A Zod schema for every request/response type is published under the `/schemas` subpath. `zod` is an **optional peer dependency** — install it if you want runtime validation:

```bash
npm install zod
```

```ts
import { schemas } from "@stronger-ecommerce/smartkart-api/schemas";

const parsed = schemas.GetItemsRequest.safeParse(input);
if (!parsed.success) throw parsed.error;
```

Useful for AI agent tool-calling (generate JSON Schemas via `zod-to-json-schema`), API gateways, and backend validation layers.

## Use as an MCP server

This package ships a built-in [Model Context Protocol](https://modelcontextprotocol.io) server, so you can let Cursor / Claude Desktop / Codex call SmartKart conversationally. Add to your MCP host config:

```jsonc
// ~/.cursor/mcp.json or ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "smartkart": {
      "command": "npx",
      "args": ["-y", "@stronger-ecommerce/smartkart-api", "smartkart-mcp"],
      "env": {
        "SMARTKART_API_TOKEN": "your-token",
        "SMARTKART_STORE_ID": "42"
      }
    }
  }
}
```

Tools exposed:

- `smartkart_get_items` — paginated item lookup with filters.
- `smartkart_get_customers` — paginated customer lookup.
- `smartkart_create_phone_order` — create a phone order.

## Use with Cursor

This package ships a Cursor rule at `.cursor/rules/smartkart-api.mdc` encoding the non-obvious patterns (PascalCase vs camelCase keys, error handling, pagination). To use it in a consumer project, copy that file into your repo's `.cursor/rules/` folder, or add it as a project rule pointing at the same content.

The repo also exposes [`llms.txt`](./llms.txt) and [`llms-full.txt`](./llms-full.txt) following the [llmstxt.org](https://llmstxt.org/) spec — Cursor, Claude Desktop, and ChatGPT can fetch these for accurate context when @-mentioning the package. An [`openapi.yaml`](./openapi.yaml) is also published for tools that consume OpenAPI (Postman, Stainless, Speakeasy, etc.).

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsup -> dist/ (esm + cjs + .d.ts + sourcemaps)
npm test            # typecheck + Vitest
```

See [`AGENTS.md`](./AGENTS.md) for repo conventions when working on the package itself.

## Constants reference

| Constant              | Values                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `UomType`             | `Standard` (0), `Case` (2)                                                                 |
| `CustomerNoteType`    | `Internal` ("0"), `ForCustomer` ("1"), `ForCashier` ("2"), `PhoneOrder` ("3"), `All` ("4") |
| `CustomerAddressType` | `Main` (6) — other numeric values for shipping/secondary                                   |
| `DEFAULT_BASE_URL`    | `"http://rdtapi.com/RDTConnectrosAPI"` (typo intentional, matches upstream)                |
| `DEFAULT_TIMEOUT_MS`  | `30000`                                                                                    |
| `DEFAULT_PAGE_SIZE`   | `100`                                                                                      |

## License

MIT
