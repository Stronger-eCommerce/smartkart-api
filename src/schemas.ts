/**
 * Zod schemas mirroring the public TypeScript types in this package.
 *
 * Available under a separate subpath so the runtime cost of `zod` is only
 * paid by consumers who actually want runtime validation or AI tool-calling
 * JSON Schema generation:
 *
 * @example
 * ```ts
 * import { schemas } from "@stronger-ecommerce/smartkart-api/schemas";
 *
 * const result = schemas.GetItemsRequest.safeParse(input);
 * if (!result.success) throw result.error;
 * ```
 *
 * `zod` is declared as an optional peer dependency. Install it explicitly:
 * `npm install zod`.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** ISO-8601 date-time string (no timezone). */
export const IsoDateTime = z.string();

export const PaginatedRequestBase = z.object({
  pageSize: z.number().int().nonnegative(),
  pageNumber: z.number().int().positive(),
});

export const ApiResponse = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.boolean(),
    description: z.string(),
    errors: z.array(z.string()).nullable(),
    data,
  });

export const PaginatedData = <T extends z.ZodTypeAny>(record: T) =>
  z.object({
    totalRecords: z.number(),
    recordsFiltered: z.number(),
    pageSize: z.number(),
    currentPage: z.number(),
    records: z.array(record),
  });

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const ItemStatus = z.enum(["Active", "Inactive"]);

export const ItemsFilter = z.object({
  storeID: z.number().int(),
  itemID: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  modelNumber: z.string().nullish(),
  upc: z.string().nullish(),
  itemType: z.string().nullish(),
  itemStatus: ItemStatus.nullish(),
  lastDateModified: IsoDateTime.nullish(),
});

export const GetItemsRequest = PaginatedRequestBase.extend({
  itemsFilter: ItemsFilter,
});

export const ItemsFilterInput = ItemsFilter.partial({ storeID: true });

export const GetItemsInput = PaginatedRequestBase.extend({
  itemsFilter: ItemsFilterInput,
});

export const ItemCustomField = z
  .object({
    name: z.string().optional(),
    value: z.unknown().optional(),
  })
  .passthrough();

export const Item = z
  .object({
    itemID: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    modelNumber: z.string().optional(),
    upc: z.string().optional(),
    itemType: z.string().optional(),
    itemStatus: ItemStatus.nullish(),
    lastDateModified: IsoDateTime.optional(),
    parent: z.string().nullish(),
    customFields: z
      .union([z.array(ItemCustomField), z.record(z.string(), z.unknown())])
      .nullish(),
  })
  .passthrough();

export const GetItemsResponse = ApiResponse(PaginatedData(Item));

// ---------------------------------------------------------------------------
// Phone orders
// ---------------------------------------------------------------------------

/** UoM type: 0 = Standard, 2 = Case. */
export const UomType = z.union([z.literal(0), z.literal(2)]);

export const PhoneOrderAddress = z.object({
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
});

export const PhoneOrderShippingAddress = z.object({
  Address1: z.string().optional(),
  Address2: z.string().optional(),
  City: z.string().optional(),
  State: z.string().optional(),
  ZipCode: z.string().optional(),
  Country: z.string().optional(),
  Phone1: z.string().optional(),
  Phone2: z.string().optional(),
});

export const PhoneOrderDetail = z.object({
  barCode: z.string(),
  qty: z.number(),
  uomType: UomType,
  note: z.string().optional(),
  sortOrder: z.number().int(),
});

export const CreatePhoneOrderRequest = z.object({
  storeID: z.number().int(),
  customerNo: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  address: PhoneOrderAddress,
  CustomerShippingAddress: z.array(PhoneOrderShippingAddress).optional(),
  driversNote: z.string().optional(),
  customerNote: z.string().optional(),
  paymentNote: z.string().optional(),
  phoneOrderDate: IsoDateTime.optional(),
  phoneOrderTime: z.string().optional(),
  deliveryDate: IsoDateTime.optional(),
  phoneOrderType: z.string(),
  TakenBy: z.string().optional(),
  Shift: z.string().optional(),
  tenderName: z.string().optional(),
  orderDetails: z.array(PhoneOrderDetail),
});

export const CreatePhoneOrderInput = CreatePhoneOrderRequest.partial({
  storeID: true,
});

export const CreatePhoneOrderData = z.object({
  phoneOrderNo: z.string(),
});

export const CreatePhoneOrderResponse = ApiResponse(CreatePhoneOrderData);

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const CustomerStatus = z.enum(["Active", "Inactive"]);

export const CustomerNoteType = z.enum(["0", "1", "2", "3", "4"]);

export const CustomerFilter = z.object({
  customerNo: z.string().nullish(),
  lastName: z.string().nullish(),
  firstName: z.string().nullish(),
  email: z.string().nullish(),
  dateCreatedFrom: IsoDateTime.nullish(),
  dateCreatedTo: IsoDateTime.nullish(),
  dateModifiedFrom: IsoDateTime.nullish(),
  dateModifiedTo: IsoDateTime.nullish(),
  phoneNumber1: z.string().nullish(),
  phoneNumber2: z.string().nullish(),
});

export const GetCustomersRequest = PaginatedRequestBase.extend({
  customerFilter: CustomerFilter,
});

export const CustomerAddress = z.object({
  customerAddressId: z.string(),
  name: z.string().nullish(),
  addressType: z.number(),
  isMain: z.boolean(),
  street1: z.string().nullish(),
  street2: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  phoneNumber1: z.string().nullish(),
  phoneNumber2: z.string().nullish(),
  isTextable: z.boolean().optional(),
  useSMS: z.boolean().optional(),
  status: CustomerStatus.optional(),
  dateCreated: IsoDateTime.optional(),
  dateModified: IsoDateTime.optional(),
});

export const CustomerNote = z.object({
  type: CustomerNoteType,
  note: z.string(),
  status: CustomerStatus,
  dateModified: IsoDateTime,
});

export const CustomerGroup = z.object({
  customerGroupId: z.string(),
  name: z.string(),
  status: CustomerStatus,
  dateModified: IsoDateTime.nullable(),
});

export const CreditCardToken = z.object({
  token: z.string().nullable(),
  ccDescription: z.string().nullable(),
  billingName: z.string().nullable(),
  zip: z.string().nullable(),
  last4: z.string().nullable(),
  isDefault: z.boolean(),
});

export const Customer = z.object({
  customerIdNumeric: z.number(),
  customerId: z.string(),
  customerNo: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  mainAddressId: z.string().nullable(),
  addresses: z.array(CustomerAddress),
  status: CustomerStatus,
  dateCreated: IsoDateTime,
  dateModified: IsoDateTime,
  accountStatus: z.string(),
  inActiveReason: z.string().nullable(),
  loyaltyMemberType: z.string().nullable(),
  oldCustNo: z.string().nullable(),
  customerNotes: z.array(CustomerNote),
  groups: z.array(CustomerGroup),
  creditCardTokens: z.array(CreditCardToken),
  taxExempt: z.boolean(),
  taxNumber: z.string(),
  lockAccount: z.boolean(),
  lockOutDays: z.number().nullable(),
  lastPaymentAmount: z.number().nullable(),
  lastPaymentDate: IsoDateTime.nullable(),
  creditLimit: z.number().nullable(),
  startBalance: z.number().nullable(),
  startBalanceDate: IsoDateTime.nullable(),
  balanceDue: z.number(),
  over0: z.number(),
  over30: z.number(),
  over60: z.number(),
  over90: z.number(),
  over120: z.number(),
  discount: z.number().nullable(),
  discountExp: IsoDateTime.nullable(),
  defaultPaymentType: z.string().nullable(),
  preferredPayDay: z.string().nullable(),
  countSales: z.number(),
  sumSales: z.number(),
  lastSaleDate: IsoDateTime.nullable(),
});

export const GetCustomersResponse = ApiResponse(PaginatedData(Customer));

// ---------------------------------------------------------------------------
// Convenience grouping
// ---------------------------------------------------------------------------

/**
 * Bundle of every named schema. Useful for tooling that wants to walk all
 * schemas (e.g. JSON Schema generation, OpenAPI emit).
 *
 * @example
 * ```ts
 * import { schemas } from "@stronger-ecommerce/smartkart-api/schemas";
 * const parsed = schemas.GetItemsRequest.parse(input);
 * ```
 */
export const schemas = {
  ApiResponse,
  PaginatedData,
  PaginatedRequestBase,
  IsoDateTime,
  ItemStatus,
  ItemsFilter,
  ItemsFilterInput,
  GetItemsRequest,
  GetItemsInput,
  ItemCustomField,
  Item,
  GetItemsResponse,
  UomType,
  PhoneOrderAddress,
  PhoneOrderShippingAddress,
  PhoneOrderDetail,
  CreatePhoneOrderRequest,
  CreatePhoneOrderInput,
  CreatePhoneOrderData,
  CreatePhoneOrderResponse,
  CustomerStatus,
  CustomerNoteType,
  CustomerFilter,
  GetCustomersRequest,
  CustomerAddress,
  CustomerNote,
  CustomerGroup,
  CreditCardToken,
  Customer,
  GetCustomersResponse,
} as const;
