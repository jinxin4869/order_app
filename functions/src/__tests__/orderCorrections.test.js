const { createFirestore, fixtures } = require("../../test-support/firestore");
const { staff, staffUser } = require("../../test-support/staff");
let mockDb;
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ getUser: async () => staffUser() }),
}));
jest.mock("firebase-admin/firestore", () => {
  const firestore = () => mockDb;
  firestore.FieldValue = { serverTimestamp: () => new Date() };
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
let api;
const ORDER = "orders/order-test";
beforeEach(() => {
  jest.resetModules();
  mockDb = createFirestore({
    ...fixtures(),
    [ORDER]: {
      restaurant_id: "rest-test",
      table_id: "table-test",
      visit_id: "visit-a",
      order_number: "20261025-001",
      status: "confirmed",
      items: [
        { item_id: "a", name_ja: "唐揚げ", quantity: 3, price: 600 },
        { item_id: "b", name_ja: "お茶", quantity: 1, price: 200 },
      ],
      subtotal: 2000,
      tax: 200,
      total_amount: 2200,
      created_at: new Date(),
    },
  });
  api = require("../orders");
});
const correct = (data = {}, auth = staff()) =>
  api.correctOrderItems({
    auth,
    data: {
      orderId: "order-test",
      expectedRevision: 0,
      changes: [{ index: 0, quantity: 1 }],
      reason: "品切れのため",
      operationId: "fix-1",
      ...data,
    },
  });
const records = () =>
  [...mockDb.all()].filter(([path]) =>
    path.startsWith(`${ORDER}/corrections/`)
  );

test("reducing a line recomputes the totals on the server and keeps the original", async () => {
  expect(await correct()).toEqual({
    success: true,
    revision: 1,
    status: "confirmed",
    total_amount: 880,
  });
  expect(mockDb.read(ORDER)).toMatchObject({
    subtotal: 800,
    tax: 80,
    total_amount: 880,
    original_total_amount: 2200,
    corrected: true,
    revision: 1,
    items: [
      expect.objectContaining({ quantity: 1, original_quantity: 3 }),
      expect.objectContaining({ quantity: 1 }),
    ],
  });
  expect(records()).toHaveLength(1);
  expect(records()[0][1]).toMatchObject({
    changes: [{ index: 0, item_id: "a", name_ja: "唐揚げ", from: 3, to: 1 }],
    total_before: 2200,
    total_after: 880,
    reason: "品切れのため",
    staff_uid: "staff-test",
  });
  const { order } = await api.getStaffOrder({
    auth: staff(),
    data: { orderId: "order-test" },
  });
  expect(order).toMatchObject({ corrected: true, revision: 1 });
  expect(order.items[0]).toMatchObject({ quantity: 1, original_quantity: 3 });
  expect(order.corrections).toEqual([
    expect.objectContaining({ total_before: 2200, total_after: 880 }),
  ]);
});
test("a second correction keeps the first original values", async () => {
  await correct();
  await correct({
    expectedRevision: 1,
    changes: [{ index: 0, quantity: 0 }],
    operationId: "fix-2",
  });
  expect(mockDb.read(ORDER)).toMatchObject({
    original_total_amount: 2200,
    total_amount: 220,
    items: [
      expect.objectContaining({ quantity: 0, original_quantity: 3 }),
      expect.anything(),
    ],
  });
});
test("cancelling every line cancels the order and records the status change", async () => {
  const result = await correct({
    changes: [
      { index: 0, quantity: 0 },
      { index: 1, quantity: 0 },
    ],
  });
  expect(result).toMatchObject({ status: "cancelled", total_amount: 0 });
  const history = [...mockDb.all()].filter(([path]) =>
    path.startsWith(`${ORDER}/status_history/`)
  );
  expect(history).toEqual([
    [
      expect.any(String),
      expect.objectContaining({
        from_status: "confirmed",
        to_status: "cancelled",
        reason: "全商品の取消：品切れのため",
      }),
    ],
  ]);
});
test("a retry after a lost response returns the saved result without correcting twice", async () => {
  const first = await correct();
  expect(await correct()).toEqual(first);
  expect(mockDb.read(ORDER).items[0].quantity).toBe(1);
  expect(records()).toHaveLength(1);
  await expect(
    correct({ changes: [{ index: 1, quantity: 0 }] })
  ).rejects.toMatchObject({ code: "already-exists" });
});
test("a stale screen cannot correct over another update", async () => {
  await correct();
  await expect(
    correct({ operationId: "fix-2", changes: [{ index: 1, quantity: 0 }] })
  ).rejects.toMatchObject({
    code: "aborted",
    details: { reason: "revision_changed", revision: 1 },
  });
});
test.each(["ready", "served", "completed", "cancelled"])(
  "an order that is %s can no longer be corrected",
  async (status) => {
    mockDb.seed(ORDER, { ...mockDb.read(ORDER), status });
    await expect(correct()).rejects.toMatchObject({
      code: "failed-precondition",
      details: { reason: "not_correctable", status },
    });
    expect(records()).toHaveLength(0);
  }
);
test.each([
  [{ changes: [{ index: 0, quantity: 3 }] }],
  [{ changes: [{ index: 0, quantity: 4 }] }],
  [{ changes: [{ index: 9, quantity: 0 }] }],
  [
    {
      changes: [
        { index: 0, quantity: 1 },
        { index: 0, quantity: 0 },
      ],
    },
  ],
  [{ changes: [] }],
  [{ changes: [{ index: 0, quantity: -1 }] }],
  [{ reason: "" }],
  [{ reason: "<b></b>" }],
  [{ reason: "x".repeat(101) }],
  [{ expectedRevision: undefined }],
  [{ operationId: "../x" }],
])("the request %p is refused before any write", async (data) => {
  await expect(correct(data)).rejects.toMatchObject({
    code: "invalid-argument",
  });
  expect(mockDb.writes).toHaveLength(0);
});
test("only staff of the order's store can correct it", async () => {
  await expect(
    api.correctOrderItems({ data: { orderId: "order-test" } })
  ).rejects.toMatchObject({ code: "unauthenticated" });
  await expect(correct({}, staff("other-store"))).rejects.toMatchObject({
    code: "permission-denied",
  });
  expect(mockDb.writes).toHaveLength(0);
});
test("customers see the corrected quantities in their visit", async () => {
  await correct();
  const { orders } = await api.listVisitOrders({
    data: {
      restaurantId: "rest-test",
      tableId: "table-test",
      visitId: "visit-a",
    },
  });
  expect(orders[0]).toMatchObject({ corrected: true, total_amount: 880 });
  expect(orders[0].items[0]).toMatchObject({
    quantity: 1,
    original_quantity: 3,
  });
});
