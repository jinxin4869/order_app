const { createFirestore, fixtures } = require("../../test-support/firestore");
let mockDb;
jest.mock("firebase-admin/firestore", () => ({ getFirestore: () => mockDb }));
jest.mock("firebase-functions/v2/https", () => ({
  onCall: (options, handler) => handler,
  HttpsError: class extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
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
// The screen words each reason in three languages; the server's own
// Japanese "error" stays for older clients.
test.each([
  ["restaurants/rest-test", { is_active: false }, "restaurant_inactive"],
  [
    "restaurants/rest-test/tables/table-test",
    { status: "unavailable" },
    "table_unavailable",
  ],
  [
    "restaurants/rest-test/tables/table-test",
    { is_active: false },
    "table_unavailable",
  ],
  [
    "restaurants/rest-test/tables/table-test",
    { qr_code: "other/table-test" },
    "qr_mismatch",
  ],
])(
  "server rejects inactive or mismatching records",
  async (path, value, reason) => {
    mockDb.seed(path, value);
    expect(
      await validate({ data: { qrData: "rest-test/table-test" } })
    ).toMatchObject({ valid: false, reason });
  }
);
test.each([
  ["rest-none/table-test", "restaurant_not_found"],
  ["rest-test/table-none", "table_not_found"],
  ["", "invalid_format"],
])("a refused QR payload %p says why", async (qrData, reason) => {
  expect(await validate({ data: { qrData } })).toMatchObject({
    valid: false,
    reason,
  });
});
test("invalid IDs do not reach Firestore", async () => {
  const query = jest.spyOn(mockDb, "collection");
  expect(await validate({ data: { qrData: "../table-test" } })).toMatchObject({
    valid: false,
    reason: "invalid_format",
  });
  expect(query).not.toHaveBeenCalled();
});
test("QR errors log only the validated IDs, not the raw payload", async () => {
  jest.spyOn(mockDb, "collection").mockImplementation(() => {
    throw new Error("unavailable");
  });
  const log = jest
    .spyOn(require("firebase-functions/logger"), "error")
    .mockImplementation(() => {});
  const qrData =
    "https://example.test/order?restaurant=rest-test&table=table-test&x=<payload>";
  expect(await validate({ data: { qrData } })).toMatchObject({ valid: false });
  expect(log.mock.calls[0][0]).toBe(
    "QR validation error for rest-test/table-test:"
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("<payload>");
});
test("a closed restaurant's menu is a warning, not an error", async () => {
  const logger = require("firebase-functions/logger");
  const warn = jest.spyOn(logger, "warn").mockImplementation(() => {});
  const error = jest.spyOn(logger, "error").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockDb.seed("restaurants/rest-test", { is_active: false });
  await expect(
    require("../menu").getMenuWithTranslation({
      data: { restaurantId: "rest-test" },
    })
  ).rejects.toThrow();
  expect(error).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith("getMenuWithTranslation refused", {
    restaurantId: "rest-test",
    code: "failed-precondition",
  });
});
test.each([undefined, null, { id: "rest-test" }, "x".repeat(129), "../x"])(
  "menu rejects the restaurant ID %p before reaching Firestore",
  async (restaurantId) => {
    const query = jest.spyOn(mockDb, "collection");
    const getMenu = require("../menu").getMenuWithTranslation;
    await expect(getMenu({ data: { restaurantId } })).rejects.toThrow();
    await expect(getMenu({ data: null })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  }
);
