const { createFirestore, fixtures } = require("../../test-support/firestore");
const { staff, staffUser } = require("../../test-support/staff");
let mockDb;
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ getUser: async () => staffUser() }),
}));
jest.mock("firebase-admin/firestore", () => {
  const firestore = () => mockDb;
  firestore.FieldValue = { serverTimestamp: () => new Date(Date.now()) };
  return { getFirestore: firestore, FieldValue: firestore.FieldValue };
});
jest.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return { HttpsError, onCall: (options, handler) => handler };
});
const START = Date.parse("2026-10-25T03:00:00Z");
let now;
let api;
beforeEach(() => {
  jest.resetModules();
  now = START;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  mockDb = createFirestore({
    ...fixtures(),
    "restaurants/rest-test/tables/table-2": {
      status: "available",
      table_number: "2",
    },
  });
  process.env.ENFORCE_ORDER_LIMITS = "true";
  process.env.ORDER_LIMIT_PER_TABLE = "3";
  process.env.ORDER_LIMIT_PER_STORE = "5";
  api = require("../orders");
  for (const method of ["log", "warn", "error"])
    jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.ENFORCE_ORDER_LIMITS;
  delete process.env.ORDER_LIMIT_PER_TABLE;
  delete process.env.ORDER_LIMIT_PER_STORE;
});
const order = (requestId, tableId = "table-test") =>
  api.createOrder({
    data: {
      restaurantId: "rest-test",
      tableId,
      requestId,
      items: [{ item_id: "item-test", quantity: 1, price: 1000 }],
      subtotal: 1000,
      tax: 100,
      totalAmount: 1100,
    },
  });
const orders = () =>
  [...mockDb.all().keys()].filter((path) => /^orders\/[^/]+$/.test(path));
const alerts = () => mockDb.read("restaurants/rest-test/rate_limits/alerts");

test("a table over its limit is refused with when to retry, leaving nothing half-saved", async () => {
  for (const id of ["r1", "r2", "r3"]) await order(id);
  const counter = mockDb.read("restaurants/rest-test/order_counters/20261025");
  await expect(order("r4")).rejects.toMatchObject({
    code: "resource-exhausted",
    details: { reason: "rate_limited", scope: "table", retryAfterSeconds: 600 },
  });
  expect(orders()).toHaveLength(3);
  expect(mockDb.read("restaurants/rest-test/order_counters/20261025")).toEqual(
    counter
  );
  expect(
    mockDb.read("restaurants/rest-test/rate_limits/table_table-test").count
  ).toBe(3);
  expect(alerts()).toMatchObject({
    count: 1,
    enforced: true,
    last_scope: "table",
    last_table_number: "12",
  });
});
test("a retry of an accepted request still returns its result and is not counted", async () => {
  const first = await order("r1");
  for (const id of ["r2", "r3"]) await order(id);
  expect(await order("r1")).toEqual(first);
  expect(
    mockDb.read("restaurants/rest-test/rate_limits/table_table-test").count
  ).toBe(3);
  expect(alerts()).toBeUndefined();
});
test("the next window accepts orders again", async () => {
  for (const id of ["r1", "r2", "r3"]) await order(id);
  now = START + 9 * 60 * 1000;
  await expect(order("r4")).rejects.toMatchObject({
    details: { retryAfterSeconds: 60 },
  });
  now = START + 10 * 60 * 1000;
  expect((await order("r5")).success).toBe(true);
});
test("other tables keep ordering until the store-wide limit", async () => {
  for (const id of ["a1", "a2", "a3"]) await order(id);
  await order("b1", "table-2");
  await order("b2", "table-2");
  await expect(order("b3", "table-2")).rejects.toMatchObject({
    details: { scope: "store", retryAfterSeconds: 60 },
  });
  now = START + 60 * 1000;
  expect((await order("b4", "table-2")).success).toBe(true);
});
test("simultaneous orders cannot slip past the limit", async () => {
  const results = await Promise.allSettled(
    ["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => order(id))
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  expect(orders()).toHaveLength(3);
});
test("without enforcement the order is accepted and only recorded", async () => {
  process.env.ENFORCE_ORDER_LIMITS = "false";
  for (const id of ["r1", "r2", "r3"]) await order(id);
  expect((await order("r4")).success).toBe(true);
  expect(orders()).toHaveLength(4);
  expect(alerts()).toMatchObject({ count: 1, enforced: false });
});
test("staff see this hour's limit hits with the order list", async () => {
  for (const id of ["r1", "r2", "r3"]) await order(id);
  await expect(order("r4")).rejects.toBeDefined();
  await expect(order("r5")).rejects.toBeDefined();
  const list = await api.listStaffOrders({ auth: staff(), data: {} });
  expect(list.limitAlert).toEqual({
    count: 2,
    enforced: true,
    lastTableNumber: "12",
    lastTableId: "table-test",
    lastAt: START,
  });
  now = START + 60 * 60 * 1000;
  expect(
    (await api.listStaffOrders({ auth: staff(), data: {} })).limitAlert
  ).toBeNull();
});
test("invalid thresholds fall back to the defaults", async () => {
  process.env.ORDER_LIMIT_PER_TABLE = "-1";
  process.env.ORDER_LIMIT_PER_STORE = "many";
  for (let index = 0; index < 10; index++) await order(`r${index}`);
  await expect(order("r10")).rejects.toMatchObject({
    details: { scope: "table" },
  });
});
