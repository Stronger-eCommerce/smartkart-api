/**
 * Example usage. This file isn't part of the published package — it's just
 * a reference for how to call each endpoint. In a Gadget action you'd
 * typically build the client once at module scope and reuse it.
 */
import {
  SmartKartClient,
  SmartKartApiError,
  UomType,
  CustomerNoteType,
  type Customer,
  type Item,
} from "../src/index.js";

const sk = new SmartKartClient({
  // In Gadget, set this in env vars and read via process.env.
  token: process.env.SMARTKART_API_TOKEN ?? "YOUR_API_TOKEN",
  defaultStoreId: 42, // optional — falls back when not provided per-request
});

// --- 1. List active items modified since a date --------------------------
async function listActiveItems(): Promise<Item[]> {
  const page = await sk.getItems({
    pageSize: 100,
    pageNumber: 1,
    itemsFilter: {
      // storeID omitted -> uses defaultStoreId
      itemStatus: "Active",
      lastDateModified: "2026-01-01T00:00:00",
    },
  });
  return page.records;
}

// --- 2. Create a phone order --------------------------------------------
async function createOrder(): Promise<string> {
  const { phoneOrderNo } = await sk.createPhoneOrder({
    customerNo: "(123)456-7890",
    firstName: "John",
    lastName: "Doe",
    address: {
      phone1: "(718)782-4608",
    },
    CustomerShippingAddress: [
      {
        Address1: "1234 5th ave",
        City: "Brooklyn",
        State: "NY",
        ZipCode: "11201",
      },
    ],
    driversNote: "Call upon arrival",
    customerNote: "Deliver after 5 PM",
    paymentNote: "Paid via Check at Delivery",
    deliveryDate: "2026-05-06T15:00:00",
    phoneOrderType: "YourAppName",
    TakenBy: "jdoe",
    Shift: "Day",
    tenderName: "YourAppName",
    orderDetails: [
      { barCode: "0376", qty: 2, uomType: UomType.Standard, note: "Fragile", sortOrder: 1 },
      { barCode: "894792002959", qty: 1, uomType: UomType.Standard, sortOrder: 2 },
    ],
  });
  return phoneOrderNo;
}

// --- 3. Look up a customer by phone -------------------------------------
async function findCustomer(customerNo: string): Promise<Customer | undefined> {
  const page = await sk.getCustomers({
    pageSize: 1,
    pageNumber: 1,
    customerFilter: { customerNo },
  });
  return page.records[0];
}

// --- Error handling pattern ---------------------------------------------
async function safeRun(): Promise<void> {
  try {
    await listActiveItems();
  } catch (err) {
    if (err instanceof SmartKartApiError) {
      console.error(
        `SmartKart error on ${err.endpoint} (status ${err.status}): ${err.apiDescription ?? err.message}`,
        err.apiErrors,
      );
    } else {
      throw err;
    }
  }
}

// Show that the constants/enums are typed:
const _phoneOrderNote: CustomerNoteType = CustomerNoteType.PhoneOrder;

// Re-export to silence "declared but never used" lints in standalone runs.
export { listActiveItems, createOrder, findCustomer, safeRun, _phoneOrderNote };
