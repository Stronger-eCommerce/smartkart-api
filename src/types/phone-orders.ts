import type { ApiResponse, IsoDateTime } from "./common.js";

/**
 * Unit of measure for an order line.
 * `0` = Standard
 * `2` = Case
 */
export const UomType = {
  Standard: 0,
  Case: 2,
} as const;
export type UomType = (typeof UomType)[keyof typeof UomType];

/**
 * Customer billing/main address on a phone order. Field names are
 * camelCase, matching the documented payload.
 */
export interface PhoneOrderAddress {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  /** Primary phone, typically formatted "(123)456-7890". */
  phone1?: string;
  phone2?: string;
}

/**
 * Shipping address as the API expects it on `CreatePhoneOrder`.
 *
 * IMPORTANT: the API uses **PascalCase** keys here (Address1, Phone1, ...)
 * unlike the camelCase `address` field. If `CustomerShippingAddress` is
 * supplied, the order ships there; the main address is only saved when the
 * customer is new or has no main address yet.
 */
export interface PhoneOrderShippingAddress {
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Country?: string;
  Phone1?: string;
  Phone2?: string;
}

export interface PhoneOrderDetail {
  /** UPC / barcode of the item being ordered. */
  barCode: string;
  /** Quantity (units, for both standard and weight items). */
  qty: number;
  /** Unit of measure: 0 = Standard, 2 = Case. */
  uomType: UomType;
  /** Free-text note attached to this line item. */
  note?: string;
  /** 1-based display order on the order. */
  sortOrder: number;
}

export interface CreatePhoneOrderRequest {
  /** Store ID assigned to you by the SmartKart office. */
  storeID: number;
  /** Usually formatted "(000)000-0000". Acts as the customer key. */
  customerNo: string;
  firstName: string;
  lastName: string;
  /** Main / billing address (camelCase keys). */
  address: PhoneOrderAddress;
  /**
   * Optional shipping address (PascalCase keys). If present, the order
   * ships there. A new shipping address record is created if it doesn't
   * match an existing one on the customer.
   */
  CustomerShippingAddress?: PhoneOrderShippingAddress[];
  driversNote?: string;
  customerNote?: string;
  paymentNote?: string;
  /** Not required in the latest version. */
  phoneOrderDate?: IsoDateTime;
  /** Not required in the latest version. */
  phoneOrderTime?: string;
  /** Time-slot delivery date (only when scheduling for later). */
  deliveryDate?: IsoDateTime;
  /** Your registered app name (acquired from the SmartKart office). */
  phoneOrderType: string;
  /** Existing SmartKart user the order is being entered on behalf of. */
  TakenBy?: string;
  /** Existing SmartKart shift name. */
  Shift?: string;
  /**
   * Tender used for payment. If your app handles payments, pass your
   * app name; otherwise use one of the tender types provided by the
   * SmartKart office.
   */
  tenderName?: string;
  orderDetails: PhoneOrderDetail[];
}

/**
 * Public input for {@link SmartKartClient.createPhoneOrder}. `storeID` is
 * optional here because the client falls back to its `defaultStoreId` when
 * omitted.
 */
export type CreatePhoneOrderInput = Omit<CreatePhoneOrderRequest, "storeID"> & {
  storeID?: number;
};

export interface CreatePhoneOrderData {
  phoneOrderNo: string;
}

export type CreatePhoneOrderResponse = ApiResponse<CreatePhoneOrderData>;
