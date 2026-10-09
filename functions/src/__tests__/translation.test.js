const { createFirestore } = require("../../test-support/firestore");
let mockDb;
let mockTranslate;
jest.mock("firebase-admin/firestore", () => {
  const firestore = () => mockDb;
  firestore.FieldValue = {
    serverTimestamp: () => new Date(),
    increment: (n) => n,
  };
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
test.each(["en", "zh"])(
  "short Japanese names translate through the same single/batch pipeline (%s)",
  async (targetLang) => {
    for (const text of ["寿司", "鰻", "酢", "お茶"]) {
      const single = await api.translateText({ data: { text, targetLang } });
      expect(single).toMatchObject({
        translatedText: "Synthetic translation",
        method: "deepl_api",
        status: "ready",
        fromCache: false,
      });
      mockDb.seed(`restaurants/rest-test/menu_items/${text}`, {
        name_ja: text,
      });
    }
    const calls = mockTranslate.mock.calls.length;
    const batch = await api.batchTranslateMenu({
      auth: staff(),
      data: { restaurantId: "rest-test", targetLang },
    });
    expect(batch.count).toBe(4);
    expect(mockTranslate).toHaveBeenCalledTimes(calls);
    for (const item of batch.items) {
      expect(item[`name_${targetLang}`]).toBe("Synthetic translation");
      expect(item[`name_${targetLang}_translation`]).toMatchObject({
        method: "deepl_api",
        status: "ready",
      });
    }
  }
);
test("numeric bypass exposes truthful metadata without configuration or dictionary access", async () => {
  delete process.env.DEEPL_API_KEY;
  expect(
    await api.translateText({ data: { text: "12 34", targetLang: "en" } })
  ).toMatchObject({
    translatedText: "12 34",
    method: "passthrough",
    status: "ready",
    usedDictionary: false,
    foundTermsCount: 0,
  });
  expect(mockTranslate).not.toHaveBeenCalled();
  expect(mockDb.writes).toHaveLength(0);
});
test.each([
  null,
  {},
  { text: "  ", targetLang: "en" },
  { text: "寿司", targetLang: "en", useDictionary: "false" },
])("malformed requests fail before translation", async (data) => {
  await expect(api.translateText({ data })).rejects.toMatchObject({
    code: "invalid-argument",
  });
  expect(mockTranslate).not.toHaveBeenCalled();
});

const dictionary = () => {
  mockDb.seed("dictionary/base", {
    term_ja: "丼",
    term_en: "bowl",
    term_zh: "盖饭",
    priority: 1,
  });
  mockDb.seed("dictionary/compound", {
    term_ja: "親子丼",
    term_en: "Oyakodon",
    term_zh: "亲子盖饭",
    priority: 2,
  });
};
test.each([
  ["en", "Oyakodon"],
  ["zh", "亲子盖饭"],
])(
  "dictionary terms are protected against wrong or untranslated API output (%s)",
  async (targetLang, expected) => {
    dictionary();
    mockTranslate.mockImplementation(async (input, source, target, options) => {
      if (!options.ignoreTags) return { text: "Wrong dish translation" };
      expect(options.tagHandling).toBe("xml");
      expect(options.ignoreTags).toEqual(["d0", "d1"]);
      expect(input).toContain(`<d0>${expected}</d0>`);
      expect(input).not.toContain("<d0>bowl</d0>");
      return { text: input.replace("と", " &amp; ") };
    });
    const result = await api.translateText({
      data: { text: "親子丼と親子丼", targetLang },
    });
    expect(result).toMatchObject({
      translatedText: `${expected} & ${expected}`,
      method: "hybrid",
      status: "ready",
      usedDictionary: true,
      foundTermsCount: 2,
    });
    expect(
      await api.translateText({ data: { text: "親子丼と親子丼", targetLang } })
    ).toEqual({ ...result, fromCache: true });
    expect(mockTranslate).toHaveBeenCalledTimes(1);
  }
);
test("literal punctuation and XML characters cannot alter dictionary matching or markup", async () => {
  mockDb.seed("dictionary/punctuation", {
    term_ja: "料理(特)",
    term_en: "Special & <dish>",
    priority: 1,
  });
  mockTranslate.mockImplementation(async (input) => ({ text: input }));
  const result = await api.translateText({
    data: { text: "料理(特) & <test>", targetLang: "en" },
  });
  expect(result.translatedText).toBe("Special & <dish> & <test>");
  expect(result.method).toBe("hybrid");
});
test("dictionary-only fallback is partial, uncached and never a successful batch result", async () => {
  dictionary();
  mockTranslate.mockRejectedValue(new Error("Synthetic outage"));
  const result = await api.translateText({
    data: { text: "親子丼をどうぞ", targetLang: "en" },
  });
  expect(result).toMatchObject({
    translatedText: "Oyakodonをどうぞ",
    status: "partial",
    method: "dictionary_fallback",
  });
  expect(mockDb.writes).toHaveLength(0);
  mockDb.seed("restaurants/rest-test/menu_items/dish", {
    name_ja: "親子丼をどうぞ",
  });
  await expect(
    api.batchTranslateMenu({
      auth: staff(),
      data: { restaurantId: "rest-test", targetLang: "en" },
    })
  ).rejects.toMatchObject({ code: "unavailable" });
  expect(mockDb.read("restaurants/rest-test/menu_items/dish")).toEqual({
    name_ja: "親子丼をどうぞ",
  });
});
test("lost protected tags cannot be cached or committed as hybrid success", async () => {
  dictionary();
  mockTranslate.mockResolvedValue({ text: "Wrong dish translation" });
  mockDb.seed("restaurants/rest-test/menu_items/dish", { name_ja: "親子丼" });
  await expect(
    api.batchTranslateMenu({
      auth: staff(),
      data: { restaurantId: "rest-test", targetLang: "en" },
    })
  ).rejects.toMatchObject({ code: "unavailable" });
  expect(mockDb.writes).toHaveLength(0);
});
test("dictionary revisions invalidate hybrid cache while methods without applied terms stay truthful", async () => {
  dictionary();
  mockTranslate.mockImplementation(async (input) => ({ text: input }));
  expect(
    (await api.translateText({ data: { text: "親子丼", targetLang: "en" } }))
      .translatedText
  ).toBe("Oyakodon");
  mockDb.seed("dictionary/compound", {
    term_ja: "親子丼",
    term_en: "Chicken and egg rice bowl",
    priority: 2,
  });
  jest.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60 * 1000);
  const changed = await api.translateText({
    data: { text: "親子丼", targetLang: "en" },
  });
  expect(changed).toMatchObject({
    translatedText: "Chicken and egg rice bowl",
    fromCache: false,
  });
  expect(
    (await api.translateText({ data: { text: "別の料理", targetLang: "en" } }))
      .method
  ).toBe("deepl_api");
});
test("kana variants apply only to an actual matched span", async () => {
  mockDb.seed("dictionary/ramen", {
    term_ja: "ラーメン",
    term_en: "Ramen",
    priority: 1,
  });
  require("../morphological").extractSpecializedTermCandidates.mockResolvedValue(
    [{ term: "らーめん" }]
  );
  mockTranslate.mockImplementation(async (input) => ({ text: input }));
  expect(
    (await api.translateText({ data: { text: "らーめん", targetLang: "en" } }))
      .translatedText
  ).toBe("Ramen");
});
test("both-mode generation covers categories, names and descriptions with separate provenance and caches", async () => {
  dictionary();
  mockTranslate.mockImplementation(async (input, source, lang, options) => ({
    text: options.ignoreTags ? input : "Plain API result",
  }));
  mockDb.seed("restaurants/rest-test", { is_active: true });
  for (const collection of ["menu_items", "menu_categories"])
    mockDb.seed(`restaurants/rest-test/${collection}/entry`, {
      name_ja: "親子丼",
      description_ja: "親子丼",
      is_available: true,
    });
  const result = await api.batchTranslateMenu({
    auth: staff(),
    data: {
      restaurantId: "rest-test",
      targetLang: "en",
      generateBothModes: true,
    },
  });
  expect(result.count).toBe(2);
  expect(mockTranslate).toHaveBeenCalledTimes(2);
  const menu = await require("../menu").getMenuWithTranslation({
    data: { restaurantId: "rest-test" },
  });
  for (const record of [...menu.categories, ...menu.items])
    for (const field of ["name", "description"]) {
      expect(record[`${field}_en`]).toBe("Oyakodon");
      expect(record[`${field}_en_nodic`]).toBe("Plain API result");
      expect(record[`${field}_en_translation`]).toMatchObject({
        mode: "dictionary",
        status: "ready",
        usedDictionary: true,
        sourceText: "親子丼",
      });
      expect(record[`${field}_en_nodic_translation`]).toMatchObject({
        mode: "deepl_only",
        status: "ready",
        usedDictionary: false,
        sourceText: "親子丼",
      });
    }
});
test("menu API never fills absent no-dictionary fields with hybrid values", async () => {
  mockDb.seed("restaurants/rest-test", { is_active: true });
  for (const collection of ["menu_items", "menu_categories"])
    mockDb.seed(`restaurants/rest-test/${collection}/entry`, {
      name_ja: "原文",
      name_en: "Hybrid only",
      description_en: "Hybrid description",
      is_available: true,
    });
  const menu = await require("../menu").getMenuWithTranslation({
    data: { restaurantId: "rest-test" },
  });
  for (const record of [...menu.categories, ...menu.items]) {
    expect(record.name_en_nodic).toBe("");
    expect(record.description_en_nodic).toBe("");
  }
});

test.each([
  ["en", "EN-US"],
  ["zh", "ZH-HANS"],
])(
  "translation handler sends the supported DeepL variant for %s",
  async (targetLang, expectedTarget) => {
    await api.translateText({ data: { text: "テスト料理", targetLang } });
    expect(mockTranslate).toHaveBeenCalledWith(
      "テスト料理",
      "JA",
      expectedTarget,
      expect.any(Object)
    );
  }
);
