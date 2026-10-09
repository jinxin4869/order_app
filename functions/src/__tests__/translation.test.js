const { createFirestore } = require("../../test-support/firestore");
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
jest.mock("../morphological", () => ({
  extractSpecializedTermCandidates: jest.fn(async () => []),
}));
jest.mock("deepl-node", () => ({
  Translator: jest.fn(() => ({
    translateText: jest.fn(async () => ({ text: "Synthetic translation" })),
  })),
}));
let api;
beforeEach(() => {
  jest.resetModules();
  mockDb = createFirestore();
  api = require("../translation");
});
test("unsupported target languages are rejected by the real handler", async () => {
  await expect(
    api.translateText({ data: { text: "テスト料理", targetLang: "fr" } })
  ).rejects.toMatchObject({ code: "invalid-argument" });
});
test("empty input is rejected by the real handler", async () => {
  await expect(
    api.translateText({ data: { text: "", targetLang: "en" } })
  ).rejects.toMatchObject({ code: "invalid-argument" });
});
test("numeric text is unchanged without service access", async () => {
  const result = await api.translateText({
    data: { text: "123", targetLang: "en" },
  });
  expect(result.translatedText).toBe("123");
  expect(mockDb.writes).toHaveLength(0);
});

const staff = (restaurantId = "rest-test", role = "staff") => ({ uid: "staff-test", token: { role, restaurantId } });
test.each([
  [undefined, "unauthenticated"],
  [staff("rest-test", "customer"), "permission-denied"],
  [staff("other-store"), "permission-denied"],
  [staff(""), "permission-denied"],
])("batch translation rejects non-staff and foreign stores", async (auth, code) => {
  const query = jest.spyOn(mockDb, "collection");
  await expect(api.batchTranslateMenu({ auth, data: { restaurantId: "rest-test", targetLang: "en" } })).rejects.toMatchObject({ code });
  expect(query).not.toHaveBeenCalled();
  expect(mockDb.writes).toHaveLength(0);
});
test("staff can translate their own store", async () => {
  expect(await api.batchTranslateMenu({ auth: staff(), data: { restaurantId: "rest-test", targetLang: "en" } })).toEqual({ count: 0, items: [] });
});
