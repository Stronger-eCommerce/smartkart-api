import type { ApiResponse, IsoDateTime, PaginatedData, PaginatedRequestBase } from "./common.js";

/**
 * Active/Inactive status used across customer, address, note, and group
 * records.
 */
export type CustomerStatus = "Active" | "Inactive";

/**
 * Customer note visibility/scope.
 *
 * `"0"` = internal
 * `"1"` = for customer
 * `"2"` = for cashier
 * `"3"` = phone order
 * `"4"` = all
 */
export const CustomerNoteType = {
  Internal: "0",
  ForCustomer: "1",
  ForCashier: "2",
  PhoneOrder: "3",
  All: "4",
} as const;
export type CustomerNoteType = (typeof CustomerNoteType)[keyof typeof CustomerNoteType];

/**
 * Address type discriminator.
 *
 * `6` = Main / billing address (the only constant explicitly documented).
 * Other numeric values are returned for shipping/secondary addresses.
 */
export const CustomerAddressType = {
  Main: 6,
} as const;
export type CustomerAddressType = number;

export interface CustomerFilter {
  /** Usually formatted "(000)000-0000" — acts as the customer key. */
  customerNo?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  email?: string | null;
  dateCreatedFrom?: IsoDateTime | null;
  dateCreatedTo?: IsoDateTime | null;
  dateModifiedFrom?: IsoDateTime | null;
  dateModifiedTo?: IsoDateTime | null;
  phoneNumber1?: string | null;
  phoneNumber2?: string | null;
}

export interface GetCustomersRequest extends PaginatedRequestBase {
  customerFilter: CustomerFilter;
}

export interface CustomerAddress {
  customerAddressId: string;
  name?: string | null;
  /** `6` = Main; other values for shipping/secondary addresses. */
  addressType: CustomerAddressType;
  /** `true` for the main address (matches `mainAddressId`). */
  isMain: boolean;
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  /** Regular phone. */
  phoneNumber1?: string | null;
  /** Mobile phone. */
  phoneNumber2?: string | null;
  isTextable?: boolean;
  useSMS?: boolean;
  status?: CustomerStatus;
  dateCreated?: IsoDateTime;
  dateModified?: IsoDateTime;
}

export interface CustomerNote {
  type: CustomerNoteType;
  note: string;
  /**
   * `"Active"` if currently in use; `"Inactive"` once deleted.
   * Useful for keeping a downstream copy in sync.
   */
  status: CustomerStatus;
  dateModified: IsoDateTime;
}

export interface CustomerGroup {
  customerGroupId: string;
  name: string;
  status: CustomerStatus;
  dateModified: IsoDateTime | null;
}

export interface CreditCardToken {
  token: string | null;
  ccDescription: string | null;
  billingName: string | null;
  zip: string | null;
  /** Last 4 of the PAN (or last 4 chars of the token, depending on processor). */
  last4: string | null;
  isDefault: boolean;
}

export interface Customer {
  customerIdNumeric: number;
  customerId: string;
  /** Usually formatted "(000)000-0000". */
  customerNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  /** Identifies which entry in `addresses` is the main/billing address. */
  mainAddressId: string | null;
  addresses: CustomerAddress[];
  status: CustomerStatus;
  dateCreated: IsoDateTime;
  dateModified: IsoDateTime;
  accountStatus: string;
  inActiveReason: string | null;
  loyaltyMemberType: string | null;
  oldCustNo: string | null;
  customerNotes: CustomerNote[];
  groups: CustomerGroup[];
  creditCardTokens: CreditCardToken[];
  taxExempt: boolean;
  taxNumber: string;
  lockAccount: boolean;
  lockOutDays: number | null;
  lastPaymentAmount: number | null;
  lastPaymentDate: IsoDateTime | null;
  creditLimit: number | null;
  startBalance: number | null;
  startBalanceDate: IsoDateTime | null;
  balanceDue: number;
  over0: number;
  over30: number;
  over60: number;
  over90: number;
  over120: number;
  /** Special customer-level discount (percentage or amount, per shop config). */
  discount: number | null;
  discountExp: IsoDateTime | null;
  defaultPaymentType: string | null;
  preferredPayDay: string | null;
  countSales: number;
  sumSales: number;
  lastSaleDate: IsoDateTime | null;
}

export type GetCustomersResponse = ApiResponse<PaginatedData<Customer>>;
