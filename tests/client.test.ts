import { describe, expect, it } from "vitest";
import {
  SmartKartClient,
  SmartKartApiError,
  isSmartKartApiError,
} from "../src/index.js";
import { envelope, failureEnvelope, fetchQueue } from "./helpers.js";

const baseConfig = {
  token: "test-token",
  baseUrl: "https://api.example.test",
  defaultStoreId: 42,
};

describe("SmartKartClient construction", () => {
  it("throws when token is missing", () => {
    expect(() => new SmartKartClient({ token: "" } as never)).toThrow(/token/);
  });

  it("throws when no fetch is available", () => {
    const originalFetch = (globalThis as { fetch?: unknown }).fetch;
    delete (globalThis as { fetch?: unknown }).fetch;
    try {
      expect(() => new SmartKartClient({ token: "x" })).toThrow(/fetch/);
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
  });
});

describe("getItems", () => {
  it("unwraps the data envelope and applies defaultStoreId", async () => {
    const { fetch, calls } = fetchQueue([
      {
        body: envelope({
          totalRecords: 1,
          recordsFiltered: 1,
          pageSize: 10,
          currentPage: 1,
          records: [{ itemID: "abc" }],
        }),
      },
    ]);
    const sk = new SmartKartClient({ ...baseConfig, fetch });

    const page = await sk.getItems({
      pageSize: 10,
      pageNumber: 1,
      itemsFilter: { itemStatus: "Active" },
    });

    expect(page.records).toHaveLength(1);
    expect(page.records[0]?.itemID).toBe("abc");
    const body = JSON.parse(calls[0]!.init!.body as string);
    expect(body.itemsFilter.storeID).toBe(42);
  });

  it("throws when storeID is missing and no default is set", async () => {
    const { fetch } = fetchQueue([{ body: envelope({}) }]);
    const sk = new SmartKartClient({ token: "x", fetch });
    await expect(
      sk.getItems({ pageSize: 1, pageNumber: 1, itemsFilter: {} }),
    ).rejects.toThrow(/storeID/);
  });

  it("throws SmartKartApiError on success: false", async () => {
    const { fetch } = fetchQueue([
      { body: failureEnvelope("invalid filter", ["bad-storeID"]) },
    ]);
    const sk = new SmartKartClient({ ...baseConfig, fetch });

    await expect(
      sk.getItems({ pageSize: 1, pageNumber: 1, itemsFilter: {} }),
    ).rejects.toMatchObject({
      name: "SmartKartApiError",
      apiDescription: "invalid filter",
    });
  });

  it("throws SmartKartApiError on non-2xx", async () => {
    const { fetch } = fetchQueue([
      {
        status: 500,
        statusText: "Internal",
        body: failureEnvelope("server boom"),
      },
    ]);
    const sk = new SmartKartClient({ ...baseConfig, fetch, retry: false });

    const err = await sk
      .getItems({ pageSize: 1, pageNumber: 1, itemsFilter: {} })
      .catch((e) => e);

    expect(isSmartKartApiError(err)).toBe(true);
    expect((err as SmartKartApiError).status).toBe(500);
    expect((err as SmartKartApiError).apiDescription).toBe("server boom");
  });

  it("sends the Token header", async () => {
    const { fetch, calls } = fetchQueue([
      { body: envelope({ totalRecords: 0, records: [] }) },
    ]);
    const sk = new SmartKartClient({ ...baseConfig, fetch });
    await sk.getItems({ pageSize: 1, pageNumber: 1, itemsFilter: {} });

    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers.Token).toBe("test-token");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

describe("createPhoneOrder", () => {
  it("returns the phoneOrderNo", async () => {
    const { fetch } = fetchQueue([
      { body: envelope({ phoneOrderNo: "PO-123" }) },
    ]);
    const sk = new SmartKartClient({ ...baseConfig, fetch });
    const result = await sk.createPhoneOrder({
      customerNo: "(123)456-7890",
      firstName: "J",
      lastName: "D",
      address: {},
      phoneOrderType: "MyApp",
      orderDetails: [],
    });
    expect(result.phoneOrderNo).toBe("PO-123");
  });
});

describe("retry", () => {
  it("retries on 503 and succeeds on 2nd attempt", async () => {
    const { fetch, calls } = fetchQueue([
      { status: 503, body: failureEnvelope("upstream down") },
      { body: envelope({ phoneOrderNo: "PO-1" }) },
    ]);
    const sk = new SmartKartClient({
      ...baseConfig,
      fetch,
      retry: { attempts: 3, baseDelayMs: 1 },
    });
    const result = await sk.createPhoneOrder({
      customerNo: "x",
      firstName: "x",
      lastName: "x",
      address: {},
      phoneOrderType: "x",
      orderDetails: [],
    });
    expect(result.phoneOrderNo).toBe("PO-1");
    expect(calls).toHaveLength(2);
  });

  it("does not retry on 400", async () => {
    const { fetch, calls } = fetchQueue([
      { status: 400, body: failureEnvelope("bad request") },
    ]);
    const sk = new SmartKartClient({
      ...baseConfig,
      fetch,
      retry: { attempts: 5, baseDelayMs: 1 },
    });
    await expect(
      sk.getItems({ pageSize: 1, pageNumber: 1, itemsFilter: {} }),
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(1);
  });

  it("respects retry: false per request", async () => {
    const { fetch, calls } = fetchQueue([
      { status: 500, body: failureEnvelope("boom") },
    ]);
    const sk = new SmartKartClient({
      ...baseConfig,
      fetch,
      retry: { attempts: 5, baseDelayMs: 1 },
    });
    await expect(
      sk.getItems(
        { pageSize: 1, pageNumber: 1, itemsFilter: {} },
        { retry: false },
      ),
    ).rejects.toMatchObject({ status: 500 });
    expect(calls).toHaveLength(1);
  });

  it("gives up after attempts and throws the last error", async () => {
    const { fetch, calls } = fetchQueue([
      { status: 500, body: failureEnvelope("boom1") },
      { status: 502, body: failureEnvelope("boom2") },
    ]);
    const sk = new SmartKartClient({
      ...baseConfig,
      fetch,
      retry: { attempts: 2, baseDelayMs: 1 },
    });
    await expect(
      sk.getItems({ pageSize: 1, pageNumber: 1, itemsFilter: {} }),
    ).rejects.toMatchObject({ status: 502 });
    expect(calls).toHaveLength(2);
  });
});

describe("timeouts", () => {
  it("aborts the request when timeoutMs elapses", async () => {
    const { fetch } = fetchQueue([
      { delayMs: 100, body: envelope({ records: [] }) },
    ]);
    const sk = new SmartKartClient({ ...baseConfig, fetch, retry: false });
    const err = await sk
      .getItems(
        { pageSize: 1, pageNumber: 1, itemsFilter: {} },
        { timeoutMs: 10 },
      )
      .catch((e) => e);
    expect(isSmartKartApiError(err)).toBe(true);
    expect((err as SmartKartApiError).status).toBe(0);
    expect((err as SmartKartApiError).message).toMatch(/timed out/);
  });
});

describe("AbortSignal", () => {
  it("propagates external abort", async () => {
    const ac = new AbortController();
    const { fetch } = fetchQueue([
      { delayMs: 100, body: envelope({ records: [] }) },
    ]);
    const sk = new SmartKartClient({ ...baseConfig, fetch, retry: false });

    const promise = sk.getItems(
      { pageSize: 1, pageNumber: 1, itemsFilter: {} },
      { signal: ac.signal },
    );
    setTimeout(() => ac.abort(new Error("user-cancel")), 5);

    await expect(promise).rejects.toBeDefined();
  });

  it("rejects immediately if signal already aborted", async () => {
    const ac = new AbortController();
    ac.abort(new Error("pre-aborted"));
    const { fetch, calls } = fetchQueue([{ body: envelope({}) }]);
    const sk = new SmartKartClient({ ...baseConfig, fetch });
    await expect(
      sk.getItems(
        { pageSize: 1, pageNumber: 1, itemsFilter: {} },
        { signal: ac.signal },
      ),
    ).rejects.toBeDefined();
    expect(calls).toHaveLength(0);
  });
});

describe("logger hook", () => {
  it("calls warn on retry", async () => {
    const warn = (() => {
      const fn = (msg: string, meta?: Record<string, unknown>) => {
        calls.push({ msg, meta });
      };
      const calls: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
      Object.assign(fn, { calls });
      return fn as ((msg: string, meta?: Record<string, unknown>) => void) & {
        calls: Array<{ msg: string; meta?: Record<string, unknown> }>;
      };
    })();

    const { fetch } = fetchQueue([
      { status: 500, body: failureEnvelope("boom") },
      { body: envelope({ records: [] }) },
    ]);
    const sk = new SmartKartClient({
      ...baseConfig,
      fetch,
      retry: { attempts: 2, baseDelayMs: 1 },
      logger: { warn },
    });
    await sk.getItems({ pageSize: 1, pageNumber: 1, itemsFilter: {} });
    expect(warn.calls.length).toBeGreaterThanOrEqual(1);
    expect(warn.calls[0]!.msg).toMatch(/retrying/);
  });
});

describe("getAllItems iterator", () => {
  it("walks pages until a short page is returned", async () => {
    const { fetch, calls } = fetchQueue([
      {
        body: envelope({
          totalRecords: 3,
          recordsFiltered: 3,
          pageSize: 2,
          currentPage: 1,
          records: [{ itemID: "a" }, { itemID: "b" }],
        }),
      },
      {
        body: envelope({
          totalRecords: 3,
          recordsFiltered: 3,
          pageSize: 2,
          currentPage: 2,
          records: [{ itemID: "c" }],
        }),
      },
    ]);
    const sk = new SmartKartClient({ ...baseConfig, fetch });

    const ids: string[] = [];
    for await (const item of sk.getAllItems({}, { pageSize: 2 })) {
      ids.push(item.itemID);
    }
    expect(ids).toEqual(["a", "b", "c"]);
    expect(calls).toHaveLength(2);
  });

  it("stops after maxPages", async () => {
    const { fetch, calls } = fetchQueue([
      {
        body: envelope({
          pageSize: 2,
          currentPage: 1,
          records: [{ itemID: "a" }, { itemID: "b" }],
          totalRecords: 1000,
          recordsFiltered: 1000,
        }),
      },
    ]);
    const sk = new SmartKartClient({ ...baseConfig, fetch });

    const ids: string[] = [];
    for await (const item of sk.getAllItems({}, { pageSize: 2, maxPages: 1 })) {
      ids.push(item.itemID);
    }
    expect(ids).toEqual(["a", "b"]);
    expect(calls).toHaveLength(1);
  });
});

describe("isSmartKartApiError", () => {
  it("recognises real errors", () => {
    const err = new SmartKartApiError({
      message: "x",
      status: 500,
      endpoint: "/x",
    });
    expect(isSmartKartApiError(err)).toBe(true);
  });

  it("rejects non-errors", () => {
    expect(isSmartKartApiError(null)).toBe(false);
    expect(isSmartKartApiError(new Error("plain"))).toBe(false);
    expect(isSmartKartApiError({ name: "SmartKartApiError" })).toBe(false);
  });

  it("recognises duck-typed errors across realms", () => {
    const err = {
      name: "SmartKartApiError",
      status: 0,
      endpoint: "/x",
      message: "y",
    };
    expect(isSmartKartApiError(err)).toBe(true);
  });
});
