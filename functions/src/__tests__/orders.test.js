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
