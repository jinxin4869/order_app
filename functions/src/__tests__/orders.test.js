const { createFirestore, fixtures } = require("../../test-support/firestore");
let mockDb;
jest.mock("firebase-admin", () => {
  const firestore = () => mockDb;
  firestore.FieldValue = {
    serverTimestamp: () => new Date(),
    increment: (n) => n,
  };
  return { firestore };
});
jest.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return {
    HttpsError,
    onCall: (options, handler) => Object.assign(handler, { options }),
  };
});
const order = (overrides = {}) => ({
  restaurantId: "rest-test",
  tableId: "table-test",
  customerLanguage: "en",
  requestId: "request-test-0001",
  items: [
    {
      item_id: "item-test",
      name: "Test dish",
      name_ja: "テスト料理",
      quantity: 2,
      price: 1000,
      notes: "No onions",
    },
  ],
  subtotal: 2000,
  tax: 200,
  totalAmount: 2200,
  ...overrides,
});
let api;
beforeEach(() => {
  jest.resetModules();
  mockDb = createFirestore(fixtures());
  api = require("../orders");
  for (const method of ["log", "warn", "error"])
    jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
test("real createOrder stores an order and occupies the table", async () => {
  const result = await api.createOrder({ data: order() });
  expect(result.success).toBe(true);
  expect(result.orderNumber).toMatch(/^\d{8}-\d{3,}$/);
  expect(mockDb.read("orders/" + result.orderId)).toMatchObject({
    restaurant_id: "rest-test",
    table_id: "table-test",
    status: "pending",
    total_amount: 2200,
  });
  expect(mockDb.read("restaurants/rest-test/tables/table-test").status).toBe(
    "occupied"
  );
});
test("missing restaurant IDs are rejected before writes", async () => {
  await expect(
    api.createOrder({ data: order({ restaurantId: "" }) })
  ).rejects.toMatchObject({ code: "invalid-argument" });
  expect(mockDb.writes).toHaveLength(0);
});
test("a missing restaurant is rejected", async () => {
  await expect(
    api.createOrder({ data: order({ restaurantId: "missing" }) })
  ).rejects.toMatchObject({ code: "not-found" });
  expect(mockDb.writes).toHaveLength(0);
});
test("quantities above the API limit are rejected", async () => {
  const data = order();
  data.items[0].quantity = 100;
  await expect(api.createOrder({ data })).rejects.toMatchObject({
    code: "invalid-argument",
  });
});
test("real status handler records valid transitions", async () => {
  mockDb.seed("orders/order-test", {
    restaurant_id: "rest-test",
    status: "pending",
  });
  await api.updateOrderStatus({
    data: { orderId: "order-test", newStatus: "confirmed" },
    auth: {
      uid: "staff-test",
      token: { role: "staff", restaurantId: "rest-test" },
    },
  });
  expect(mockDb.read("orders/order-test")).toMatchObject({
    status: "confirmed",
    confirmed_at: expect.any(Date),
  });
});
test("terminal orders cannot return to confirmed", async () => {
  mockDb.seed("orders/order-test", {
    restaurant_id: "rest-test",
    status: "completed",
  });
  await expect(
    api.updateOrderStatus({
      data: { orderId: "order-test", newStatus: "confirmed" },
      auth: {
        uid: "staff-test",
        token: { role: "staff", restaurantId: "rest-test" },
      },
    })
  ).rejects.toMatchObject({ code: "failed-precondition" });
});

const staff = (restaurantId = "rest-test", role = "staff") => ({
  uid: "staff-test",
  token: { role, restaurantId },
});
test.each([
  [undefined, "unauthenticated"],
  [staff("rest-test", "customer"), "permission-denied"],
  [staff("other-store"), "permission-denied"],
  [staff(""), "permission-denied"],
])(
  "status update rejects insufficient or foreign staff permissions",
  async (auth, code) => {
    mockDb.seed("orders/order-test", {
      restaurant_id: "rest-test",
      status: "pending",
    });
    await expect(
      api.updateOrderStatus({
        auth,
        data: { orderId: "order-test", newStatus: "confirmed" },
      })
    ).rejects.toMatchObject({ code });
    expect(mockDb.writes).toHaveLength(0);
    expect(mockDb.read("orders/order-test").status).toBe("pending");
  }
);
test("unauthenticated status calls fail before any database query", async () => {
  const query = jest.spyOn(mockDb, "collection");
  await expect(api.updateOrderStatus({ data: null })).rejects.toMatchObject({
    code: "unauthenticated",
  });
  expect(query).not.toHaveBeenCalled();
});

test.each([
  null,
  [],
  "not-an-order",
  {},
  order({ restaurantId: "../invalid" }),
  order({ tableId: 123 }),
  order({ items: {} }),
  order({ items: [null] }),
  order({ items: [] }),
  order({
    items: Array(101).fill({ item_id: "item-test", price: 1000, quantity: 1 }),
  }),
  order({ customerLanguage: false }),
  order({ customerLanguage: "fr" }),
  order({ subtotal: NaN }),
  order({ tax: Infinity }),
  order({ totalAmount: "2200" }),
  order({ customerNotes: "x".repeat(201) }),
  ...[0, 100, 1.5, NaN, Infinity, "2"].map((quantity) =>
    order({ items: [{ item_id: "item-test", price: 1000, quantity }] })
  ),
  ...[NaN, Infinity, -1, "1000"].map((price) =>
    order({ items: [{ item_id: "item-test", price, quantity: 1 }] })
  ),
  ...[123, "x".repeat(201)].map((notes) =>
    order({
      items: [{ item_id: "item-test", price: 1000, quantity: 1, notes }],
    })
  ),
  order({
    items: [
      {
        item_id: "item-test",
        price: 1000,
        quantity: 1,
        special_request: "legacy",
      },
    ],
  }),
])(
  "invalid input consistently returns invalid-argument before writes",
  async (data) => {
    await expect(api.createOrder({ data })).rejects.toMatchObject({
      code: "invalid-argument",
    });
    expect(mockDb.writes).toHaveLength(0);
  }
);
test("notes are validated and sanitized without changing the caller, and names come from the master", async () => {
  const data = order();
  data.items[0].notes = " <b>No onions</b> ";
  data.items[0].name_en = "Forged name";
  const result = await api.createOrder({ data });
  expect(mockDb.read("orders/" + result.orderId).items[0]).toMatchObject({
    notes: "No onions",
    name: "Test dish",
    name_ja: "テスト料理",
    name_en: "Test dish",
    name_zh: "测试菜",
  });
  expect(data.items[0].notes).toBe(" <b>No onions</b> ");
});

test.each([
  [
    "restaurants/rest-test",
    { name: "Test restaurant", is_active: false },
    "failed-precondition",
  ],
  [
    "restaurants/rest-test/tables/table-test",
    { status: "unavailable" },
    "failed-precondition",
  ],
  [
    "restaurants/rest-test/menu_items/item-test",
    { name_ja: "テスト料理", price: 1000, is_available: false },
    "failed-precondition",
  ],
  [
    "restaurants/rest-test/menu_items/item-test",
    { name_ja: "テスト料理", price: NaN, is_available: true },
    "failed-precondition",
  ],
])(
  "closed or invalid catalog entries cannot produce an order",
  async (path, value, code) => {
    mockDb.seed(path, value);
    await expect(api.createOrder({ data: order() })).rejects.toMatchObject({
      code,
    });
    expect(mockDb.writes).toHaveLength(0);
  }
);
test("another restaurant's product is rejected", async () => {
  mockDb.seed("restaurants/other-store/menu_items/foreign-item", {
    name_ja: "他店舗商品",
    is_available: true,
    price: 1000,
  });
  await expect(
    api.createOrder({
      data: order({
        items: [{ item_id: "foreign-item", quantity: 2, price: 1000 }],
      }),
    })
  ).rejects.toMatchObject({ code: "not-found" });
  expect(mockDb.writes).toHaveLength(0);
});
test.each([0, 999, 1100])(
  "tampered or stale prices require refreshing and do not save",
  async (price) => {
    const data = order();
    data.items[0].price = price;
    await expect(api.createOrder({ data })).rejects.toMatchObject({
      code: "failed-precondition",
      details: { reason: "price_changed", price: 1000 },
    });
    expect(mockDb.writes).toHaveLength(0);
  }
);
test("tampered client totals are rejected even when unit prices match", async () => {
  await expect(
    api.createOrder({ data: order({ subtotal: 0, tax: 0, totalAmount: 0 }) })
  ).rejects.toMatchObject({
    code: "invalid-argument",
    details: { reason: "total_mismatch" },
  });
  expect(mockDb.writes).toHaveLength(0);
});

test("a lost response can be retried with the same request ID without another order", async () => {
  const first = await api.createOrder({ data: order() });
  const writes = mockDb.writes.length;
  mockDb.seed("restaurants/rest-test/menu_items/item-test", {
    price: 9999,
    is_available: false,
  });
  const retry = await api.createOrder({ data: order() });
  expect(retry).toEqual(first);
  expect(mockDb.writes).toHaveLength(writes);
  expect(
    [...mockDb.all().keys()].filter((path) => path.startsWith("orders/"))
  ).toHaveLength(1);
});
test("concurrent duplicate submissions return one order and number", async () => {
  const results = await Promise.all(
    Array.from({ length: 12 }, () => api.createOrder({ data: order() }))
  );
  expect(new Set(results.map((result) => result.orderId)).size).toBe(1);
  expect(new Set(results.map((result) => result.orderNumber)).size).toBe(1);
  expect(
    [...mockDb.all().keys()].filter((path) => path.startsWith("orders/"))
  ).toHaveLength(1);
});
test("different payloads cannot reuse an existing request ID", async () => {
  await api.createOrder({ data: order() });
  const data = order();
  data.items[0].notes = "Different notes";
  await expect(api.createOrder({ data })).rejects.toMatchObject({
    code: "already-exists",
  });
  expect(
    [...mockDb.all().keys()].filter((path) => path.startsWith("orders/"))
  ).toHaveLength(1);
});
test("table update failure rolls back order and request records together, then retry succeeds", async () => {
  mockDb.failNextWrite("restaurants/rest-test/tables/table-test");
  await expect(api.createOrder({ data: order() })).rejects.toMatchObject({
    code: "internal",
  });
  expect(mockDb.read("restaurants/rest-test/tables/table-test").status).toBe(
    "available"
  );
  expect(mockDb.writes).toHaveLength(0);
  expect(
    [...mockDb.all().keys()].filter((path) =>
      /^(orders|order_requests)\//.test(path)
    )
  ).toHaveLength(0);
  expect((await api.createOrder({ data: order() })).success).toBe(true);
});
test("an order must have a request ID", async () => {
  await expect(
    api.createOrder({ data: order({ requestId: undefined }) })
  ).rejects.toMatchObject({ code: "invalid-argument" });
  expect(mockDb.writes).toHaveLength(0);
});

afterEach(() => jest.useRealTimers());
const freeze = (instant) => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(new Date(instant));
};
test("parallel distinct orders have unique sequential numbers from one daily counter", async () => {
  freeze("2026-10-09T03:00:00Z");
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      api.createOrder({ data: order({ requestId: `distinct-${index}` }) })
    )
  );
  expect(new Set(results.map((result) => result.orderNumber)).size).toBe(20);
  expect(
    mockDb.read("restaurants/rest-test/order_counters/20261009").last_sequence
  ).toBe(20);
  expect(results[0].orderNumber).toBe("20261009-001");
  expect(results[19].orderNumber).toBe("20261009-020");
});
test("JST midnight starts a new day, while retrying yesterday keeps the original number", async () => {
  freeze("2026-10-08T14:59:59.999Z");
  const before = await api.createOrder({ data: order() });
  expect(before.orderNumber).toBe("20261008-001");
  jest.setSystemTime(new Date("2026-10-08T15:00:00.000Z"));
  const after = await api.createOrder({
    data: order({ requestId: "next-day-request" }),
  });
  expect(after.orderNumber).toBe("20261009-001");
  expect(await api.createOrder({ data: order() })).toEqual(before);
});
test("counters are scoped to a restaurant", async () => {
  freeze("2026-10-09T03:00:00Z");
  for (const [path, value] of Object.entries(fixtures()))
    mockDb.seed(path.replace("rest-test", "other-store"), value);
  const [first, second] = await Promise.all([
    api.createOrder({ data: order() }),
    api.createOrder({ data: order({ restaurantId: "other-store" }) }),
  ]);
  expect(first.orderNumber).toBe("20261009-001");
  expect(second.orderNumber).toBe("20261009-001");
});
test("table failures do not consume a daily sequence", async () => {
  freeze("2026-10-09T03:00:00Z");
  mockDb.failNextWrite("restaurants/rest-test/tables/table-test");
  await expect(api.createOrder({ data: order() })).rejects.toMatchObject({
    code: "internal",
  });
  expect(
    mockDb.read("restaurants/rest-test/order_counters/20261009")
  ).toBeUndefined();
  expect((await api.createOrder({ data: order() })).orderNumber).toBe(
    "20261009-001"
  );
});
test("existing legacy orders require explicit counter initialization", async () => {
  freeze("2026-10-09T03:00:00Z");
  mockDb.seed("orders/legacy", {
    restaurant_id: "rest-test",
    order_number: "20261009-040",
  });
  await expect(api.createOrder({ data: order() })).rejects.toMatchObject({
    code: "failed-precondition",
    details: { reason: "counter_initialization_required" },
  });
  expect(mockDb.writes).toHaveLength(0);
  mockDb.seed("restaurants/rest-test/order_counters/20261009", {
    last_sequence: 40,
  });
  expect((await api.createOrder({ data: order() })).orderNumber).toBe(
    "20261009-041"
  );
});

test("the shared maximum quantity of 99 is accepted by the real order handler", async () => {
  const data = order({ subtotal: 99000, tax: 9900, totalAmount: 108900 });
  data.items[0].quantity = 99;
  const result = await api.createOrder({ data });
  expect(mockDb.read("orders/" + result.orderId).items[0].quantity).toBe(99);
});
