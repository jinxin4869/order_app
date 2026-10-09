import { translationField, translationDisplay } from "../translationDisplay";

const entity = {
  name_ja: "寿司",
  name_en: "Hybrid sushi",
  name_en_nodic: "Plain sushi",
  name_en_translation: {
    schemaVersion: 1,
    sourceText: "寿司",
    mode: "dictionary",
    status: "ready",
    method: "hybrid",
    usedDictionary: true,
  },
  name_en_nodic_translation: {
    schemaVersion: 1,
    sourceText: "寿司",
    mode: "deepl_only",
    status: "ready",
    method: "deepl_only",
    usedDictionary: false,
  },
};
test("switching freely displays only each selected mode", () => {
  expect(translationDisplay(entity, "name", "en", "dictionary")).toBe(
    "Hybrid sushi"
  );
  expect(translationDisplay(entity, "name", "en", "deepl_only")).toBe(
    "Plain sushi"
  );
  expect(translationDisplay(entity, "name", "en", "dictionary")).toBe(
    "Hybrid sushi"
  );
});
test.each(["name", "description"])(
  "missing %s never uses another mode, and is visibly marked",
  (field) => {
    const data = { [`${field}_ja`]: "原文", [`${field}_en`]: "Hybrid only" };
    expect(translationField(data, field, "en", "deepl_only")).toEqual({
      text: "原文",
      status: "missing",
    });
    expect(translationDisplay(data, field, "en", "deepl_only")).toContain(
      "Translation unavailable; Japanese original"
    );
    expect(translationDisplay(data, field, "en", "deepl_only")).not.toContain(
      "Hybrid only"
    );
  }
);
test.each([
  { name_en_nodic_translation: undefined },
  { name_ja: "変更した原文" },
  {
    name_en_nodic_translation: {
      ...entity.name_en_nodic_translation,
      usedDictionary: true,
      method: "hybrid",
    },
  },
])(
  "unverified, stale or hybrid-generated values cannot be labeled DeepL only",
  (change) => {
    expect(
      translationField({ ...entity, ...change }, "name", "en", "deepl_only")
        .status
    ).toBe("unverified");
  }
);
test("failed and partial results have distinct labels and cannot pass as completed translations", () => {
  const failed = {
    ...entity,
    name_en_nodic_translation: {
      ...entity.name_en_nodic_translation,
      status: "failed",
    },
  };
  expect(translationDisplay(failed, "name", "en", "deepl_only")).toContain(
    "Translation failed; Japanese original"
  );
  const partial = {
    ...entity,
    name_en: "Sushiの参考訳",
    name_en_translation: {
      ...entity.name_en_translation,
      status: "partial",
      method: "dictionary_fallback",
    },
  };
  expect(translationDisplay(partial, "name", "en", "dictionary")).toBe(
    "Sushiの参考訳 [Partial reference translation; cannot compare]"
  );
  expect(translationDisplay(partial, "name", "zh", "dictionary")).toContain(
    "未生成翻译"
  );
});
