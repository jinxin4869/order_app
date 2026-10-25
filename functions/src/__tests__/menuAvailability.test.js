const { createFirestore, fixtures } = require("../../test-support/firestore");
const { staff, staffUser } = require("../../test-support/staff");
let mockDb;
let mockGetUser;
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ getUser: (...args) => mockGetUser(...args) }),
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
const ITEMS = "restaurants/rest-test/menu_items";
let staffApi, menuApi, ordersApi;
beforeEach(() => {
  jest.resetModules();
  mockDb = createFirestore({
    ...fixtures(),
    "restaurants/rest-test/menu_categories/main": {
      name_ja: "料理",
      is_available: true,
    },
    "restaurants/rest-test/menu_categories/hidden": {
      name_ja: "非公開",
      is_available: false,
    },
    [`${ITEMS}/sold-out`]: {
      name_ja: "売り切れ料理",
      price: 500,
      is_available: false,
      is_published: true,
      category_id: "main",
    },
    [`${ITEMS}/private`]: {
      name_ja: "非公開料理",
      price: 500,
      is_available: true,
      is_published: false,
    },
    [`${ITEMS}/legacy-off`]: {
      name_ja: "旧・販売不可",
      price: 500,
      is_available: false,
    },
    [`${ITEMS}/in-hidden`]: {
      name_ja: "非公開カテゴリ",
      price: 500,
      is_available: true,
      category_id: "hidden",
    },
  });
  mockGetUser = jest.fn(async () => staffUser());
  staffApi = require("../menu/staff");
  menuApi = require("../menu");
  ordersApi = require("../orders");
  for (const method of ["log", "warn", "error"])
    jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const setItem = (data, auth = staff()) =>
  staffApi.setMenuItemAvailability({
    auth,
    data: {
      itemId: "item-test",
      available: false,
      expectedVersion: 0,
      operationId: "op-1",
      ...data,
    },
  });
const setOrdering = (data, auth = staff()) =>
  staffApi.setOrderingAvailability({
    auth,
    data: { enabled: false, expectedVersion: 0, operationId: "op-o", ...data },
  });
const order = (itemId = "item-test", requestId = "request-1") =>
  ordersApi.createOrder({
    data: {
      restaurantId: "rest-test",
      tableId: "table-test",
      requestId,
      items: [
        {
          item_id: itemId,
          quantity: 1,
          price: itemId === "item-test" ? 1000 : 500,
        },
      ],
      subtotal: itemId === "item-test" ? 1000 : 500,
      tax: itemId === "item-test" ? 100 : 50,
      totalAmount: itemId === "item-test" ? 1100 : 550,
    },
  });

test("customers get published items, sold out included, and the ordering state", async () => {
  const menu = await menuApi.getMenuWithTranslation({
    data: { restaurantId: "rest-test" },
  });
  expect(menu.restaurant.ordering).toBe("open");
  expect(
    Object.fromEntries(menu.items.map((item) => [item.id, item.is_available]))
  ).toEqual({ "item-test": true, "sold-out": false });
  expect(
    await menuApi.getMenuAvailability({ data: { restaurantId: "rest-test" } })
  ).toEqual({ ordering: "open", soldOut: ["sold-out"] });
});
test("staff see the same published items with their state and version", async () => {
  const menu = await staffApi.getStaffMenu({ auth: staff(), data: {} });
  expect(menu.restaurant).toEqual({
    name: "Test restaurant",
    ordering: "open",
    version: 0,
  });
  expect(menu.items.map((item) => [item.id, item.available])).toEqual([
    ["item-test", true],
    ["sold-out", false],
  ]);
  expect(menu.categories.map((category) => category.id)).toEqual(["main"]);
});
test("marking sold out keeps the item visible, logs once and replays a retry", async () => {
  const result = await setItem({});
  expect(result).toEqual({ success: true, available: false, version: 1 });
  expect(mockDb.read(`${ITEMS}/item-test`)).toMatchObject({
    is_available: false,
    is_published: true,
    availability_version: 1,
  });
  expect(mockDb.read("restaurants/rest-test/menu_events/op-1")).toMatchObject({
    type: "item_availability",
    item_id: "item-test",
    from: true,
    to: false,
    staff_uid: "staff-test",
  });
  // The same operation after a lost response returns the saved result.
  expect(await setItem({})).toEqual(result);
  const writes = mockDb.writes.length;
  await expect(setItem({ available: true })).rejects.toMatchObject({
    code: "already-exists",
  });
  expect(mockDb.writes.length).toBe(writes);
  const menu = await menuApi.getMenuWithTranslation({
    data: { restaurantId: "rest-test" },
  });
  expect(menu.items.find((item) => item.id === "item-test").is_available).toBe(
    false
  );
});
test("a stale screen cannot overwrite another staff member's change", async () => {
  await setItem({});
  await expect(
    setItem({ available: true, operationId: "op-2" })
  ).rejects.toMatchObject({
    code: "aborted",
    details: { reason: "version_changed", available: false, version: 1 },
  });
  expect(mockDb.read(`${ITEMS}/item-test`).is_available).toBe(false);
  expect(
    await setItem({ available: true, expectedVersion: 1, operationId: "op-3" })
  ).toEqual({ success: true, available: true, version: 2 });
});
test.each(["private", "legacy-off", "missing"])(
  "the private or unknown item %s cannot be changed or revealed",
  async (itemId) => {
    await expect(setItem({ itemId, available: true })).rejects.toMatchObject({
      code: "not-found",
    });
    expect(mockDb.read(`${ITEMS}/${itemId}`)?.is_published).not.toBe(true);
  }
);
test("only staff of the store can change availability, with valid input", async () => {
  await expect(
    staffApi.setMenuItemAvailability({ data: {} })
  ).rejects.toMatchObject({ code: "unauthenticated" });
  await expect(setItem({}, staff("other-store"))).rejects.toMatchObject({
    code: "permission-denied",
  });
  for (const bad of [
    { available: "no" },
    { expectedVersion: -1 },
    { operationId: undefined },
    { itemId: "../x" },
  ])
    await expect(setItem(bad)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  expect(mockDb.writes).toHaveLength(0);
});
test("pausing stops new orders but keeps store, items and accepted retries", async () => {
  const accepted = await order();
  expect(await setOrdering({})).toEqual({
    success: true,
    ordering: "paused",
    version: 1,
  });
  expect(mockDb.read("restaurants/rest-test")).toMatchObject({
    is_active: true,
    ordering_enabled: false,
  });
  await expect(order("item-test", "request-2")).rejects.toMatchObject({
    code: "failed-precondition",
    details: { reason: "ordering_paused" },
  });
  // A retry of an order accepted before the pause returns its result.
  expect(await order()).toEqual(accepted);
  expect(
    (await menuApi.getMenuAvailability({ data: { restaurantId: "rest-test" } }))
      .ordering
  ).toBe("paused");
  await expect(
    setOrdering({ enabled: true, operationId: "op-p2" })
  ).rejects.toMatchObject({
    code: "aborted",
  });
  await setOrdering({
    enabled: true,
    expectedVersion: 1,
    operationId: "op-p3",
  });
  expect((await order("item-test", "request-3")).success).toBe(true);
});
test("a malformed ordering setting accepts no orders until staff resume", async () => {
  mockDb.seed("restaurants/rest-test", {
    name: "Test restaurant",
    is_active: true,
    ordering_enabled: "yes",
  });
  await expect(order()).rejects.toMatchObject({
    details: { reason: "ordering_unconfigured" },
  });
  await setOrdering({ enabled: true });
  expect((await order()).success).toBe(true);
});
test.each(["sold-out", "private", "legacy-off", "in-hidden"])(
  "the item %s cannot be ordered",
  async (itemId) => {
    await expect(order(itemId)).rejects.toMatchObject({
      code: "failed-precondition",
      details: { reason: "item_unavailable", itemId },
    });
  }
);
