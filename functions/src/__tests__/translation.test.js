const { createFirestore } = require("../../test-support/firestore");
let mockDb;
let mockTranslate;
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
    translateText: (...args) => mockTranslate(...args),
  })),
}));
let api;
beforeEach(() => {
  jest.resetModules();
  process.env.DEEPL_API_KEY = "synthetic-test-key-not-a-real-secret";
  mockTranslate = jest.fn(async () => ({ text: "Synthetic translation" }));
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
  "batch translation rejects non-staff and foreign stores",
  async (auth, code) => {
    const query = jest.spyOn(mockDb, "collection");
    await expect(
      api.batchTranslateMenu({
        auth,
        data: { restaurantId: "rest-test", targetLang: "en" },
      })
    ).rejects.toMatchObject({ code });
    expect(query).not.toHaveBeenCalled();
    expect(mockDb.writes).toHaveLength(0);
  }
);
test("staff can translate their own store", async () => {
  expect(
    await api.batchTranslateMenu({
      auth: staff(),
      data: { restaurantId: "rest-test", targetLang: "en" },
    })
  ).toEqual({ count: 0, items: [] });
});

afterEach(() => {
  delete process.env.DEEPL_API_KEY;
  jest.restoreAllMocks();
});
test("both translation functions explicitly bind the Secret", () => {
  expect(api.translateText.options.secrets).toEqual(["DEEPL_API_KEY"]);
  expect(api.batchTranslateMenu.options.secrets).toEqual(["DEEPL_API_KEY"]);
});
test("missing translation configuration fails without writing originals", async () => {
  delete process.env.DEEPL_API_KEY;
  mockDb.seed("restaurants/rest-test/menu_items/test-item", {
    name_ja: "テスト料理",
  });
  await expect(
    api.batchTranslateMenu({
      auth: staff(),
      data: { restaurantId: "rest-test", targetLang: "en" },
    })
  ).rejects.toMatchObject({
    code: "failed-precondition",
    details: { reason: "translation_not_configured" },
  });
  expect(mockDb.writes).toHaveLength(0);
});
test("API failure cannot save fallback Japanese as a successful batch translation", async () => {
  mockDb.seed("restaurants/rest-test/menu_items/test-item", {
    name_ja: "テスト料理",
  });
  mockTranslate.mockRejectedValue(new Error("Synthetic API failure"));
  await expect(
    api.batchTranslateMenu({
      auth: staff(),
      data: {
        restaurantId: "rest-test",
        targetLang: "en",
        generateBothModes: true,
      },
    })
  ).rejects.toMatchObject({ code: "unavailable" });
  expect(mockDb.read("restaurants/rest-test/menu_items/test-item")).toEqual({
    name_ja: "テスト料理",
  });
});
test("batch translation succeeds with an injected synthetic translator", async () => {
  mockDb.seed("restaurants/rest-test/menu_items/test-item", {
    name_ja: "テスト料理",
  });
  const result = await api.batchTranslateMenu({
    auth: staff(),
    data: { restaurantId: "rest-test", targetLang: "en" },
  });
  expect(result.count).toBe(1);
  expect(
    mockDb.read("restaurants/rest-test/menu_items/test-item").name_en
  ).toBe("Synthetic translation");
});
test("failure in the second mode cannot commit either translation to the menu", async () => {
  const path = "restaurants/rest-test/menu_items/test-item";
  mockDb.seed(path, { name_ja: "テスト料理" });
  mockTranslate
    .mockResolvedValueOnce({ text: "Synthetic hybrid" })
    .mockRejectedValueOnce(new Error("Synthetic second-mode failure"));
  await expect(
    api.batchTranslateMenu({
      auth: staff(),
      data: {
        restaurantId: "rest-test",
        targetLang: "en",
        generateBothModes: true,
      },
    })
  ).rejects.toMatchObject({ code: "unavailable" });
  expect(mockDb.read(path)).toEqual({ name_ja: "テスト料理" });
});
