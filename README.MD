# smartkart-api

Typed TypeScript client for the [SmartKart](https://smartkartpos.com) (RDT Connectors) API.

Wraps the three currently-published endpoints:

| Method             | Endpoint                             | Description                          |
| ------------------ | ------------------------------------ | ------------------------------------ |
| `getItems`         | `POST /api/OpenAPI/GetItems`         | Paginated item list with filters     |
| `createPhoneOrder` | `POST /api/OpenAPI/CreatePhoneOrder` | Create a phone order                 |
| `getCustomers`     | `POST /api/Customers/GetCustomers`   | Paginated customer list with filters |

## Install

```bash
npm install @stronger-ecommerce/smartkart-api
# or
pnpm add @stronger-ecommerce/smartkart-api
# or
yarn add @stronger-ecommerce/smartkart-api
```

Requires Node 18+ (or any runtime with global `fetch` — modern browsers, Bun, Gadget, Cloudflare Workers, ...). On older Node, pass a fetch polyfill via `options.fetch`.

## Quick start

```ts
import { SmartKartClient, SmartKartApiError, UomType } from "@stronger-ecommerce/smartkart-api";

const sk = new SmartKartClient({
  token: process.env.SMARTKART_API_TOKEN!, // sent as `Token` header
  defaultStoreId: 42, // optional, fills in storeID where applicable
});

const { records, totalRecords } = await sk.getItems({
  pageSize: 30,
  pageNumber: 1,
  itemsFilter: { itemStatus: "Active" },
});
```

## Configuration

```ts
new SmartKartClient({
  token, // required
  baseUrl, // default: "http://rdtapi.com/RDTConnectrosAPI"
  defaultStoreId, // optional fallback storeID
  fetch, // optional custom fetch
  endpoints: { getItems: "..." }, // override individual endpoint paths
  defaultHeaders: { "X-Trace": "abc" },
});
```

## Endpoints

### `getItems(request) → PaginatedData<Item>`

```ts
const page = await sk.getItems({
  pageSize: 100,
  pageNumber: 1,
  itemsFilter: {
    // storeID omitted -> uses defaultStoreId
    itemStatus: "Active", // "Active" | "Inactive" | null (= all)
    lastDateModified: "2026-01-01T00:00:00",
  },
});
```

`Item` has explicit fields for everything documented (`itemID`, `name`, `upc`, `parent`, `customFields`, ...) plus an index signature so any extra fields the API returns aren't silently dropped.

### `createPhoneOrder(request) → { phoneOrderNo }`

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

Note the API expects **PascalCase** keys on `CustomerShippingAddress` (`Address1`, `Phone1`, ...) but camelCase on `address`. The types preserve that exactly so the wire payload is correct.

### `getCustomers(request) → PaginatedData<Customer>`

```ts
const page = await sk.getCustomers({
  pageSize: 50,
  pageNumber: 1,
  customerFilter: { customerNo: "(718)782-4608" },
});
const customer = page.records[0];
```

`Customer` is fully typed including nested `addresses`, `customerNotes`, `groups`, and `creditCardTokens`.

## Error handling

Both HTTP failures and `success: false` envelopes throw a `SmartKartApiError`:

```ts
try {
  await sk.getItems({ pageSize: 30, pageNumber: 1, itemsFilter: {} });
} catch (err) {
  if (err instanceof SmartKartApiError) {
    console.error(err.endpoint, err.status, err.apiDescription, err.apiErrors);
  }
}
```

Fields available: `status`, `endpoint`, `apiDescription`, `apiErrors`, `rawBody`.

On success, methods return the unwrapped `data` payload — you don't need to check `.success` yourself.

## Use in a Gadget app

1. Add the package: `npm install @stronger-ecommerce/smartkart-api` (or drop `src/` into `api/utilities/smartkart-api`).
2. Add `SMARTKART_API_TOKEN` (and optionally `SMARTKART_STORE_ID`) to Gadget's environment variables.
3. From an action:

```ts
// api/actions/syncItems.ts
import { SmartKartClient } from "@stronger-ecommerce/smartkart-api";

export const run = async ({ logger }) => {
  const sk = new SmartKartClient({
    token: process.env.SMARTKART_API_TOKEN!,
    defaultStoreId: Number(process.env.SMARTKART_STORE_ID),
  });
  const { records } = await sk.getItems({
    pageSize: 100,
    pageNumber: 1,
    itemsFilter: { itemStatus: "Active" },
  });
  logger.info({ count: records.length }, "fetched smartkart items");
};
```

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsup -> dist/ (esm + cjs + .d.ts)
```

## Constants reference

| Constant              | Values                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `UomType`             | `Standard` (0), `Case` (2)                                                                 |
| `CustomerNoteType`    | `Internal` ("0"), `ForCustomer` ("1"), `ForCashier` ("2"), `PhoneOrder` ("3"), `All` ("4") |
| `CustomerAddressType` | `Main` (6) — other numeric values for shipping/secondary                                   |

## License

MIT

# smartkart-api

Typed TypeScript client for the [SmartKart](https://smartkartpos.com) (RDT Connectors) API.

Wraps the three currently-published endpoints:

| Method             | Endpoint                             | Description                          |
| ------------------ | ------------------------------------ | ------------------------------------ |
| `getItems`         | `POST /api/OpenAPI/GetItems`         | Paginated item list with filters     |
| `createPhoneOrder` | `POST /api/OpenAPI/CreatePhoneOrder` | Create a phone order                 |
| `getCustomers`     | `POST /api/Customers/GetCustomers`   | Paginated customer list with filters |

## Install

```bash
npm install @stronger-ecommerce/smartkart-api
# or
pnpm add @stronger-ecommerce/smartkart-api
# or
yarn add @stronger-ecommerce/smartkart-api
```

Requires Node 18+ (or any runtime with global `fetch` — modern browsers, Bun, Gadget, Cloudflare Workers, ...). On older Node, pass a fetch polyfill via `options.fetch`.

## Quick start

```ts
import { SmartKartClient, SmartKartApiError, UomType } from "@stronger-ecommerce/smartkart-api";

const sk = new SmartKartClient({
  token: process.env.SMARTKART_API_TOKEN!, // sent as `Token` header
  defaultStoreId: 42, // optional, fills in storeID where applicable
});

const { records, totalRecords } = await sk.getItems({
  pageSize: 30,
  pageNumber: 1,
  itemsFilter: { itemStatus: "Active" },
});
```

## Configuration

```ts
new SmartKartClient({
  token, // required
  baseUrl, // default: "http://rdtapi.com/RDTConnectrosAPI"
  defaultStoreId, // optional fallback storeID
  fetch, // optional custom fetch
  endpoints: { getItems: "..." }, // override individual endpoint paths
  defaultHeaders: { "X-Trace": "abc" },
});
```

## Endpoints

### `getItems(request) → PaginatedData<Item>`

```ts
const page = await sk.getItems({
  pageSize: 100,
  pageNumber: 1,
  itemsFilter: {
    // storeID omitted -> uses defaultStoreId
    itemStatus: "Active", // "Active" | "Inactive" | null (= all)
    lastDateModified: "2026-01-01T00:00:00",
  },
});
```

`Item` has explicit fields for everything documented (`itemID`, `name`, `upc`, `parent`, `customFields`, ...) plus an index signature so any extra fields the API returns aren't silently dropped.

### `createPhoneOrder(request) → { phoneOrderNo }`

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

Note the API expects **PascalCase** keys on `CustomerShippingAddress` (`Address1`, `Phone1`, ...) but camelCase on `address`. The types preserve that exactly so the wire payload is correct.

### `getCustomers(request) → PaginatedData<Customer>`

```ts
const page = await sk.getCustomers({
  pageSize: 50,
  pageNumber: 1,
  customerFilter: { customerNo: "(718)782-4608" },
});
const customer = page.records[0];
```

`Customer` is fully typed including nested `addresses`, `customerNotes`, `groups`, and `creditCardTokens`.

## Error handling

Both HTTP failures and `success: false` envelopes throw a `SmartKartApiError`:

```ts
try {
  await sk.getItems({ pageSize: 30, pageNumber: 1, itemsFilter: {} });
} catch (err) {
  if (err instanceof SmartKartApiError) {
    console.error(err.endpoint, err.status, err.apiDescription, err.apiErrors);
  }
}
```

Fields available: `status`, `endpoint`, `apiDescription`, `apiErrors`, `rawBody`.

On success, methods return the unwrapped `data` payload — you don't need to check `.success` yourself.

## Use in a Gadget app

1. Add the package: `npm install smartkart-api` (or drop `src/` into `api/utilities/smartkart-api`).
2. Add `SMARTKART_API_TOKEN` (and optionally `SMARTKART_STORE_ID`) to Gadget's environment variables.
3. From an action:

```ts
// api/actions/syncItems.ts
import { SmartKartClient } from "@stronger-ecommerce/smartkart-api";

export const run = async ({ logger }) => {
  const sk = new SmartKartClient({
    token: process.env.SMARTKART_API_TOKEN!,
    defaultStoreId: Number(process.env.SMARTKART_STORE_ID),
  });
  const { records } = await sk.getItems({
    pageSize: 100,
    pageNumber: 1,
    itemsFilter: { itemStatus: "Active" },
  });
  logger.info({ count: records.length }, "fetched smartkart items");
};
```

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsup -> dist/ (esm + cjs + .d.ts)
```

## Constants reference

| Constant              | Values                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `UomType`             | `Standard` (0), `Case` (2)                                                                 |
| `CustomerNoteType`    | `Internal` ("0"), `ForCustomer` ("1"), `ForCashier` ("2"), `PhoneOrder` ("3"), `All` ("4") |
| `CustomerAddressType` | `Main` (6) — other numeric values for shipping/secondary                                   |

## License

MIT
# smartkart-api
