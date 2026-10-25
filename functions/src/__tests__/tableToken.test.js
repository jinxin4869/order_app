const { createFirestore, fixtures } = require("../../test-support/firestore");
let mockDb;
jest.mock("firebase-admin/auth", () => ({ getAuth: () => ({}) }));
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
const { parseQRCode } = require("../utils/qr");
const SECRET = "restaurants/rest-test/table_secrets/table-test";
let tokens, menu, orders;
beforeEach(() => {
  jest.resetModules();
  mockDb = createFirestore(fixtures());
  tokens = require("../utils/tableToken");
  menu = require("../menu");
  orders = require("../orders");
  delete process.env.ENFORCE_TABLE_TOKEN;
  for (const method of ["log", "warn", "error"])
    jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.ENFORCE_TABLE_TOKEN;
});
const issue = async () =>
  (await tokens.issueTableTokens(mockDb, "rest-test", ["table-test"]))[0].token;
const validate = (qrData) => menu.validateQRCode({ data: { qrData } });
const order = (tableToken, requestId = "request-1") =>
  orders.createOrder({
    data: {
      restaurantId: "rest-test",
      tableId: "table-test",
      requestId,
      ...(tableToken === undefined ? {} : { tableToken }),
      items: [{ item_id: "item-test", quantity: 1, price: 1000 }],
      subtotal: 1000,
      tax: 100,
      totalAmount: 1100,
    },
  });

test.each([
  [
    "rest-test/table-test",
    { restaurantId: "rest-test", tableId: "table-test" },
  ],
  [
    "rest-test/table-test/abcdefghijklmnop_-12",
    {
      restaurantId: "rest-test",
      tableId: "table-test",
      token: "abcdefghijklmnop_-12",
    },
  ],
  [
    "https://example.test/order?restaurant=rest-test&table=table-test&token=abcdefghijklmnop",
    {
      restaurantId: "rest-test",
      tableId: "table-test",
      token: "abcdefghijklmnop",
    },
  ],
  ["rest-test/table-test/short", null],
  ["rest-test/table-test/abcdefghijklmnop!", null],
  [
    "https://example.test/order?restaurant=rest-test&table=table-test&token=abcdefghijklmnop&token=abcdefghijklmnoq",
    null,
  ],
  ["a/b/abcdefghijklmnop/extra", null],
])("the QR %s parses to %p", (value, expected) =>
  expect(parseQRCode(value)).toEqual(expected)
);

test("only a hash is stored, and reissuing replaces the old token", async () => {
  const first = await issue();
  expect(first).toMatch(/^[A-Za-z0-9_-]{24}$/);
  const saved = mockDb.read(SECRET);
  expect(saved.token_hash).toBe(tokens.hashTableToken(first));
  expect(
    JSON.stringify(mockDb.read("restaurants/rest-test/tables/table-test"))
  ).not.toContain(first);
  const second = await issue();
  const secret = { exists: true, data: () => mockDb.read(SECRET) };
  expect(tokens.matchesTableToken(secret, second)).toBe(true);
  expect(tokens.matchesTableToken(secret, first)).toBe(false);
  await expect(
    tokens.issueTableTokens(mockDb, "rest-test", ["missing"])
  ).rejects.toThrow("Table not found: missing");
});

test("without enforcement, existing QR codes keep working", async () => {
  expect((await validate("rest-test/table-test")).valid).toBe(true);
  expect((await order()).success).toBe(true);
});

test("with enforcement, only the current token passes QR validation", async () => {
  const token = await issue();
  process.env.ENFORCE_TABLE_TOKEN = "true";
  expect((await validate("rest-test/table-test")).valid).toBe(false);
  expect(
    (await validate("rest-test/table-test/abcdefghijklmnopqrstuvwx")).valid
  ).toBe(false);
  const ok = await validate(`rest-test/table-test/${token}`);
  expect(ok.valid).toBe(true);
  expect(JSON.stringify(ok)).not.toContain(token);
  expect(JSON.stringify(ok)).not.toContain(tokens.hashTableToken(token));
});

test("with enforcement, an order needs the table's current token", async () => {
  const token = await issue();
  process.env.ENFORCE_TABLE_TOKEN = "true";
  for (const bad of [undefined, "abcdefghijklmnopqrstuvwx"])
    await expect(order(bad)).rejects.toMatchObject({
      code: "failed-precondition",
      details: { reason: "table_token_invalid" },
    });
  const accepted = await order(token);
  expect(accepted.success).toBe(true);
  // An accepted request is still recognised after the token is rotated.
  await issue();
  expect(await order(token)).toEqual(accepted);
});

test("a table without an issued token accepts nothing once enforced", async () => {
  process.env.ENFORCE_TABLE_TOKEN = "true";
  expect((await validate("rest-test/table-test/abcdefghijklmnop")).valid).toBe(
    false
  );
  await expect(order("abcdefghijklmnop")).rejects.toMatchObject({
    details: { reason: "table_token_invalid" },
  });
});

test("a malformed token is refused even without enforcement", async () => {
  await expect(order("bad token!")).rejects.toMatchObject({
    code: "invalid-argument",
  });
});
