const { createFirestore, fixtures } = require("../../test-support/firestore");
const { staff, staffUser } = require("../../test-support/staff");
let mockDb;
let mockClaims;
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUser: async () => staffUser({ customClaims: mockClaims }),
  }),
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
const ITEM = "restaurants/rest-test/menu_items/item-test";
const DRAFT = "restaurants/rest-test/menu_drafts/item-test";
let editor, menu, orders;
beforeEach(() => {
  jest.resetModules();
  mockClaims = { role: "staff", restaurantId: "rest-test", canEditMenu: true };
  mockDb = createFirestore(fixtures());
  mockDb.seed(ITEM, {
    ...mockDb.read(ITEM),
    description_ja: "旧説明",
    name_en: "Test dish",
    name_en_translation: {
      schemaVersion: 1,
      sourceText: "テスト料理",
      mode: "dictionary",
      status: "ready",
    },
  });
  editor = require("../menu/editor");
  menu = require("../menu");
  orders = require("../orders");
  for (const method of ["log", "warn", "error"])
    jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const draft = (overrides = {}) => ({
  name_ja: "新テスト料理",
  description_ja: "新しい説明",
  price: 1200,
  image_url: "https://images.example.test/dish.jpg",
  ...overrides,
});
const save = (data = {}) =>
  editor.saveMenuItemDraft({
    auth: staff(),
    data: {
      itemId: "item-test",
      expectedVersion: 0,
      draft: draft(),
      operationId: "save-1",
      ...data,
    },
  });
const publish = (data = {}) =>
  editor.publishMenuItemDraft({
    auth: staff(),
    data: {
      itemId: "item-test",
      expectedVersion: 0,
      operationId: "publish-1",
      ...data,
    },
  });
const customerItem = async () =>
  (
    await menu.getMenuWithTranslation({ data: { restaurantId: "rest-test" } })
  ).items.find((item) => item.id === "item-test");

test("only staff granted canEditMenu in their current claims may edit", async () => {
  mockClaims = { role: "staff", restaurantId: "rest-test" };
  await expect(save()).rejects.toMatchObject({ code: "permission-denied" });
  // A token claim alone is not enough; the current Auth record decides.
  await expect(
    editor.saveMenuItemDraft({
      auth: { ...staff(), token: { ...staff().token, canEditMenu: true } },
      data: {
        itemId: "item-test",
        expectedVersion: 0,
        draft: draft(),
        operationId: "x-1",
      },
    })
  ).rejects.toMatchObject({ code: "permission-denied" });
  await expect(editor.saveMenuItemDraft({ data: {} })).rejects.toMatchObject({
    code: "unauthenticated",
  });
  expect(mockDb.writes).toHaveLength(0);
});
test("a draft stays private until it is published", async () => {
  expect(await save()).toMatchObject({ success: true, base_version: 0 });
  expect(mockDb.read(DRAFT)).toMatchObject({
    name_ja: "新テスト料理",
    price: 1200,
    base_version: 0,
  });
  expect(await customerItem()).toMatchObject({
    name_ja: "テスト料理",
    price: 1000,
  });
  const editable = await editor.getEditableMenuItem({
    auth: staff(),
    data: { itemId: "item-test" },
  });
  expect(editable.item).toMatchObject({ name_ja: "テスト料理", version: 0 });
  expect(editable.draft).toMatchObject({
    name_ja: "新テスト料理",
    base_version: 0,
  });
});
test("publishing copies the draft, bumps the version, logs and drops the draft", async () => {
  await save();
  expect(await publish()).toEqual({
    success: true,
    version: 1,
    translationsOutdated: true,
  });
  expect(mockDb.read(ITEM)).toMatchObject({
    name_ja: "新テスト料理",
    description_ja: "新しい説明",
    price: 1200,
    image_url: "https://images.example.test/dish.jpg",
    content_version: 1,
  });
  expect(mockDb.read(DRAFT)).toBeUndefined();
  const event = mockDb.read("restaurants/rest-test/menu_events/publish-1");
  expect(event).toMatchObject({
    type: "item_content",
    from: { name_ja: "テスト料理", price: 1000 },
    to: { name_ja: "新テスト料理", price: 1200 },
    staff_uid: "staff-test",
  });
  // The old translation no longer matches the Japanese source, so screens
  // fall back to the original until translations are regenerated.
  const item = await customerItem();
  expect(item.name_ja).toBe("新テスト料理");
  expect(item.name_en_translation.sourceText).not.toBe(item.name_ja);
  // Same operation after a lost response returns the saved result.
  expect(await publish()).toMatchObject({ version: 1 });
});
test("a price-only change keeps translations current", async () => {
  await save({
    draft: draft({ name_ja: "テスト料理", description_ja: "旧説明" }),
  });
  expect((await publish()).translationsOutdated).toBe(false);
});
test("orders keep the price they were placed at; carts with the old price must refresh", async () => {
  const before = await orders.createOrder({
    data: {
      restaurantId: "rest-test",
      tableId: "table-test",
      requestId: "request-before",
      items: [{ item_id: "item-test", quantity: 1, price: 1000 }],
      subtotal: 1000,
      tax: 100,
      totalAmount: 1100,
    },
  });
  await save();
  await publish();
  expect(mockDb.read(`orders/${before.orderId}`).items[0].price).toBe(1000);
  await expect(
    orders.createOrder({
      data: {
        restaurantId: "rest-test",
        tableId: "table-test",
        requestId: "request-after",
        items: [{ item_id: "item-test", quantity: 1, price: 1000 }],
        subtotal: 1000,
        tax: 100,
        totalAmount: 1100,
      },
    })
  ).rejects.toMatchObject({
    details: { reason: "price_changed", price: 1200 },
  });
});
test("stale versions, outdated drafts and missing drafts are refused", async () => {
  await save();
  await publish();
  await expect(save({ operationId: "save-2" })).rejects.toMatchObject({
    code: "aborted",
    details: { reason: "version_changed", version: 1 },
  });
  // A draft made on version 1, then someone publishes version 2 first.
  await save({
    expectedVersion: 1,
    operationId: "save-3",
    draft: draft({ price: 1300 }),
  });
  mockDb.seed(ITEM, { ...mockDb.read(ITEM), content_version: 2 });
  await expect(
    publish({ expectedVersion: 2, operationId: "publish-2" })
  ).rejects.toMatchObject({ details: { reason: "draft_outdated" } });
  await editor.discardMenuItemDraft({
    auth: staff(),
    data: { itemId: "item-test" },
  });
  await expect(
    publish({ expectedVersion: 2, operationId: "publish-3" })
  ).rejects.toMatchObject({ details: { reason: "no_draft" } });
});
test("reusing an operation ID for different content is refused", async () => {
  await save();
  await expect(save({ draft: draft({ price: 999 }) })).rejects.toMatchObject({
    code: "already-exists",
  });
});
test.each([
  [{ name_ja: "" }],
  [{ name_ja: "x".repeat(101) }],
  [{ name_ja: "<b></b>" }],
  [{ description_ja: "x".repeat(501) }],
  [{ description_ja: 3 }],
  [{ price: -1 }],
  [{ price: 10.5 }],
  [{ price: 1_000_001 }],
  [{ image_url: "http://images.example.test/a.jpg" }],
  [{ image_url: "javascript:alert(1)" }],
  [{ image_url: `https://example.test/${"x".repeat(500)}` }],
  [{ allergens: [] }],
])("the draft %p is refused before any write", async (change) => {
  await expect(save({ draft: draft(change) })).rejects.toMatchObject({
    code: "invalid-argument",
  });
  expect(mockDb.writes).toHaveLength(0);
});
test("tags are stripped, and an empty image removes it", async () => {
  await save({
    draft: draft({
      name_ja: " <i>新</i>料理 ",
      description_ja: "<p>説明</p>",
      image_url: " ",
    }),
  });
  expect(mockDb.read(DRAFT)).toMatchObject({
    name_ja: "新料理",
    description_ja: "説明",
    image_url: null,
  });
});
test("private items cannot be opened or edited here", async () => {
  mockDb.seed(ITEM, { ...mockDb.read(ITEM), is_published: false });
  await expect(
    editor.getEditableMenuItem({ auth: staff(), data: { itemId: "item-test" } })
  ).rejects.toMatchObject({ code: "not-found" });
  await expect(save()).rejects.toMatchObject({ code: "not-found" });
});
