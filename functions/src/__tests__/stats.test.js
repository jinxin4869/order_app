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
const at = (time) => new Date(`2026-10-25T${time}:00+09:00`);
const seed = (id, data) =>
  mockDb.seed(`orders/${id}`, {
    restaurant_id: "rest-test",
    business_day: "20261025",
    status: "served",
    created_at: at("12:00"),
    items: [],
    ...data,
  });
let stats;
beforeEach(() => {
  jest.resetModules();
  mockDb = createFirestore(fixtures());
  stats = require("../orders/stats");
  seed("a", {
    created_at: at("12:00"),
    confirmed_at: at("12:02"),
    served_at: at("12:20"),
    items: [
      { item_id: "karaage", name_ja: "唐揚げ", quantity: 2 },
      { item_id: "tea", name_ja: "お茶", quantity: 1 },
    ],
  });
  seed("b", {
    status: "completed",
    created_at: at("12:10"),
    confirmed_at: at("12:11"),
    served_at: at("12:20"),
    corrected: true,
    items: [
      {
        item_id: "karaage",
        name_ja: "唐揚げ",
        quantity: 1,
        original_quantity: 3,
      },
      { item_id: "tea", name_ja: "お茶", quantity: 0, original_quantity: 1 },
    ],
  });
  // Served before the feature recorded times: missing, not estimated.
  seed("old", { items: [{ item_id: "tea", name_ja: "お茶", quantity: 1 }] });
  seed("open", {
    status: "preparing",
    items: [{ item_id: "edamame", name_ja: "枝豆", quantity: 4 }],
  });
  seed("cancelled", {
    status: "cancelled",
    items: [{ item_id: "edamame", name_ja: "枝豆", quantity: 9 }],
  });
  // Placed just before midnight and served after it: still the 25th.
  seed("late", {
    created_at: at("23:55"),
    confirmed_at: at("23:56"),
    served_at: new Date("2026-10-26T00:10:00+09:00"),
    items: [{ item_id: "tea", name_ja: "お茶", quantity: 1 }],
  });
  seed("next-day", {
    business_day: "20261026",
    items: [{ item_id: "tea", name_ja: "お茶", quantity: 5 }],
  });
  seed("other-store", {
    restaurant_id: "other-store",
    items: [{ item_id: "tea", name_ja: "お茶", quantity: 5 }],
  });
});
const daily = (data = { day: "20261025" }, auth = staff()) =>
  stats.getDailyStats({ auth, data });

test("counts orders and item quantities after corrections, without cancelled orders", async () => {
  const result = await daily();
  expect(result.orders).toEqual({
    total: 6,
    active: 5,
    cancelled: 1,
    corrected: 1,
    served: 4,
  });
  expect(result.itemQuantity).toBe(10);
  expect(result.popular).toEqual([
    { item_id: "edamame", name_ja: "枝豆", quantity: 4, orders: 1 },
    { item_id: "tea", name_ja: "お茶", quantity: 3, orders: 3 },
    { item_id: "karaage", name_ja: "唐揚げ", quantity: 3, orders: 2 },
  ]);
  expect(result.truncated).toBe(false);
});
test("times until served use recorded times and report missing ones", async () => {
  const { durations } = await daily();
  expect(durations.orderToServed).toEqual({
    count: 3,
    missing: 1,
    medianMinutes: 15,
    averageMinutes: 15,
  });
  // 18, 9 and 14 minutes from confirmation.
  expect(durations.confirmedToServed).toEqual({
    count: 3,
    missing: 1,
    medianMinutes: 14,
    averageMinutes: 13.7,
  });
});
test("a day without orders is reported as empty, not as an error", async () => {
  const result = await daily({ day: "20261020" });
  expect(result.orders.total).toBe(0);
  expect(result.popular).toEqual([]);
  expect(result.durations.orderToServed).toMatchObject({
    count: 0,
    medianMinutes: null,
  });
});
test("only one valid business day of the staff member's store is read", async () => {
  for (const day of ["2026-10-25", "20261332", "20260230", 20261025])
    await expect(daily({ day })).rejects.toMatchObject({
      code: "invalid-argument",
    });
  await expect(
    stats.getDailyStats({ data: { day: "20261025" } })
  ).rejects.toMatchObject({ code: "unauthenticated" });
  expect((await daily({ day: "20261026" })).orders.total).toBe(1);
});
test("reading stops at the cap and says so", async () => {
  for (let index = 0; index < 2001; index++)
    mockDb.seed(`orders/bulk-${index}`, {
      restaurant_id: "rest-test",
      business_day: "20261024",
      status: "pending",
      items: [],
    });
  const result = await daily({ day: "20261024" });
  expect(result.truncated).toBe(true);
  expect(result.orders.total).toBe(2000);
});
test("serving an order records when it was served", async () => {
  mockDb.seed("orders/ready", { restaurant_id: "rest-test", status: "ready" });
  const orders = require("../orders");
  await orders.updateOrderStatus({
    auth: staff(),
    data: { orderId: "ready", expectedStatus: "ready", newStatus: "served" },
  });
  expect(mockDb.read("orders/ready").served_at).toEqual(expect.any(Date));
});
