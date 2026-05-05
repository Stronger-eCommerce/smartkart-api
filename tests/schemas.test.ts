import { describe, expect, it } from "vitest";
import { schemas } from "../src/schemas.js";

describe("schemas", () => {
  it("validates a GetItemsRequest", () => {
    const parsed = schemas.GetItemsRequest.parse({
      pageSize: 10,
      pageNumber: 1,
      itemsFilter: { storeID: 42, itemStatus: "Active" },
    });
    expect(parsed.itemsFilter.storeID).toBe(42);
  });

  it("rejects invalid itemStatus", () => {
    const result = schemas.GetItemsRequest.safeParse({
      pageSize: 10,
      pageNumber: 1,
      itemsFilter: { storeID: 42, itemStatus: "Pending" },
    });
    expect(result.success).toBe(false);
  });

  it("allows omitting storeID on GetItemsInput", () => {
    const result = schemas.GetItemsInput.safeParse({
      pageSize: 10,
      pageNumber: 1,
      itemsFilter: { itemStatus: "Active" },
    });
    expect(result.success).toBe(true);
  });

  it("validates a CreatePhoneOrder payload", () => {
    const result = schemas.CreatePhoneOrderRequest.safeParse({
      storeID: 42,
      customerNo: "x",
      firstName: "A",
      lastName: "B",
      address: { phone1: "555" },
      phoneOrderType: "App",
      orderDetails: [{ barCode: "1", qty: 2, uomType: 0, sortOrder: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown UomType values", () => {
    const result = schemas.PhoneOrderDetail.safeParse({
      barCode: "1",
      qty: 1,
      uomType: 5,
      sortOrder: 1,
    });
    expect(result.success).toBe(false);
  });

  it("preserves unknown Item fields via passthrough", () => {
    const item = schemas.Item.parse({
      itemID: "x",
      somethingNew: 123,
    });
    expect((item as Record<string, unknown>).somethingNew).toBe(123);
  });
});
