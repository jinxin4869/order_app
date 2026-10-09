const { createFirestore, fixtures } = require("../../test-support/firestore");
let mockDb;
jest.mock("firebase-admin", () => ({ firestore: () => mockDb }));
jest.mock("firebase-functions/v2/https", () => ({
  onCall: (options, handler) => handler,
  HttpsError: class extends Error {},
}));
let validate;
beforeEach(() => {
  jest.resetModules();
  mockDb = createFirestore(fixtures());
  validate = require("../menu").validateQRCode;
});
test.each([
  "rest-test/table-test",
  "https://example.test/order?restaurant=rest-test&table=table-test",
])("server validates the QR payload %s", async (qrData) => {
  const result = await validate({ data: { qrData } });
  expect(result).toMatchObject({
    valid: true,
    restaurant: { id: "rest-test" },
    table: { id: "table-test" },
  });
});
test.each([
  ["restaurants/rest-test", { is_active: false }],
  ["restaurants/rest-test/tables/table-test", { status: "unavailable" }],
  ["restaurants/rest-test/tables/table-test", { is_active: false }],
  ["restaurants/rest-test/tables/table-test", { qr_code: "other/table-test" }],
])("server rejects inactive or mismatching records", async (path, value) => {
  mockDb.seed(path, value);
  expect(await validate({ data: { qrData: "rest-test/table-test" } })).toMatchObject({ valid: false });
});
test("invalid IDs do not reach Firestore", async () => {
  const query = jest.spyOn(mockDb, "collection");
  expect(await validate({ data: { qrData: "../table-test" } })).toMatchObject({ valid: false });
  expect(query).not.toHaveBeenCalled();
});
