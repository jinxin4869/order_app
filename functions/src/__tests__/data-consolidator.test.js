/**
 * データ統合ユーティリティのテスト
 */

const consolidator = require("../utils/data-consolidator");

describe("データ統合ユーティリティ", () => {
  describe("parseCSVLine", () => {
    // parseCSVLineは内部関数なので直接テストできない
    // 代わりにparseCSVでテストする
  });

  describe("convertDishData", () => {
    test("料理データを統合フォーマットに変換", () => {
      const rows = [
        {
          id: "sushi_001",
          term_ja: "マグロ",
          reading: "まぐろ",
          term_en: "Tuna",
          term_zh: "金枪鱼",
          category: "sushi",
          subcategory: "akami",
          priority: "1",
          notes: "赤身",
        },
      ];

      const result = consolidator.convertDishData(rows);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("sushi_001");
      expect(result[0].term_ja).toBe("マグロ");
      expect(result[0].term_en).toBe("Tuna");
      expect(result[0].priority).toBe(1);
      expect(result[0].type).toBe("dish_name");
    });

    test("空の配列を処理", () => {
      const result = consolidator.convertDishData([]);
      expect(result).toEqual([]);
    });

    test("必須フィールドが欠けている場合のフォールバック", () => {
      const rows = [
        {
          term_ja: "唐揚げ",
          // 他のフィールドなし
        },
      ];

      const result = consolidator.convertDishData(rows);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("");
      expect(result[0].term_ja).toBe("唐揚げ");
      expect(result[0].priority).toBe(999);
    });
  });

  describe("convertCookingMethodData", () => {
    test("料理法データを統合フォーマットに変換", () => {
      const rows = [
        {
          Japanese: "炙り焼き",
          English: "seared/grilled",
          Chinese_simplified: "炙烤",
          Category: "cooking_method",
        },
      ];

      const result = consolidator.convertCookingMethodData(rows);

      expect(result).toHaveLength(1);
      expect(result[0].term_ja).toBe("炙り焼き");
      expect(result[0].term_en).toBe("seared/grilled");
      expect(result[0].term_zh).toBe("炙烤");
      expect(result[0].category).toBe("cooking_method");
      expect(result[0].type).toBe("cooking_method");
    });

    test("複数のカテゴリを処理", () => {
      const rows = [
        {
          Japanese: "炙り焼き",
          English: "seared",
          Chinese_simplified: "炙烤",
          Category: "cooking_method",
        },
        {
          Japanese: "定食",
          English: "set meal",
          Chinese_simplified: "套餐",
          Category: "dish_type",
        },
      ];

      const result = consolidator.convertCookingMethodData(rows);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("cooking_method");
      expect(result[0].priority).toBe(100);
      expect(result[1].type).toBe("dish_type");
      expect(result[1].priority).toBe(200);
    });

    test("空の日本語フィールドをスキップ", () => {
      const rows = [
        {
          Japanese: "",
          English: "test",
          Chinese_simplified: "测试",
          Category: "cooking_method",
        },
      ];

      const result = consolidator.convertCookingMethodData(rows);
      expect(result).toEqual([]);
    });
  });

  describe("consolidateData", () => {
    test("データを統合して重複を削除", () => {
      const dishData = [
        { term_ja: "唐揚げ", priority: 1 },
        { term_ja: "寿司", priority: 2 },
      ];

      const cookingMethodData = [
        { term_ja: "唐揚げ", priority: 100 }, // 重複
        { term_ja: "炙り焼き", priority: 100 },
      ];

      const result = consolidator.consolidateData(dishData, cookingMethodData);

      // 重複が削除されている
      expect(result).toHaveLength(3);

      // term_jaのリストを確認
      const termJaList = result.map((item) => item.term_ja);
      expect(termJaList).toContain("唐揚げ");
      expect(termJaList).toContain("寿司");
      expect(termJaList).toContain("炙り焼き");

      // 最初の出現が保持される（優先度1の唐揚げ）
      const karaage = result.find((item) => item.term_ja === "唐揚げ");
      expect(karaage.priority).toBe(1);
    });

    test("優先度順にソート", () => {
      const dishData = [
        { term_ja: "C", priority: 300 },
        { term_ja: "A", priority: 100 },
        { term_ja: "B", priority: 200 },
      ];

      const result = consolidator.consolidateData(dishData, []);

      expect(result[0].term_ja).toBe("A");
      expect(result[1].term_ja).toBe("B");
      expect(result[2].term_ja).toBe("C");
    });

    test("term_jaが空の場合はスキップ", () => {
      const dishData = [
        { term_ja: "", priority: 1 },
        { term_ja: "寿司", priority: 2 },
      ];

      const result = consolidator.consolidateData(dishData, []);
      expect(result).toHaveLength(1);
      expect(result[0].term_ja).toBe("寿司");
    });
  });

  describe("toFirestoreFormat", () => {
    test("Firestore形式に変換", () => {
      const data = [
        {
          id: "test_001",
          term_ja: "唐揚げ",
          reading: "からあげ",
          term_en: "karaage",
          term_zh: "日式炸鸡",
          category: "dish",
          subcategory: "fried",
          priority: 1,
          type: "dish_name",
          notes: "人気メニュー",
        },
      ];

      const result = consolidator.toFirestoreFormat(data);

      expect(result["test_001"]).toBeDefined();
      expect(result["test_001"].term_ja).toBe("唐揚げ");
      expect(result["test_001"].translations).toEqual({
        en: "karaage",
        zh: "日式炸鸡",
      });
      expect(result["test_001"].category).toBe("dish");
      expect(result["test_001"].priority).toBe(1);
      expect(result["test_001"].type).toBe("dish_name");
      expect(result["test_001"].updated_at).toBeDefined();
    });

    test("複数のアイテムを変換", () => {
      const data = [
        {
          id: "item1",
          term_ja: "A",
          reading: "",
          term_en: "A_en",
          term_zh: "A_zh",
          category: "cat1",
          subcategory: "",
          priority: 1,
          type: "type1",
          notes: "",
        },
        {
          id: "item2",
          term_ja: "B",
          reading: "",
          term_en: "B_en",
          term_zh: "B_zh",
          category: "cat2",
          subcategory: "",
          priority: 2,
          type: "type2",
          notes: "",
        },
      ];

      const result = consolidator.toFirestoreFormat(data);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result["item1"]).toBeDefined();
      expect(result["item2"]).toBeDefined();
    });

    test("IDがない場合は自動生成", () => {
      const data = [
        {
          id: "",
          term_ja: "テスト",
          reading: "",
          term_en: "test",
          term_zh: "测试",
          category: "test",
          subcategory: "",
          priority: 1,
          type: "test_type",
          notes: "",
        },
      ];

      const result = consolidator.toFirestoreFormat(data);
      const keys = Object.keys(result);

      expect(keys).toHaveLength(1);
      expect(keys[0]).toContain("term_");
    });
  });

  describe("統合処理の総合テスト", () => {
    test("料理データの変換と統合フロー", () => {
      // 料理データ
      const dishRows = [
        {
          id: "sushi_001",
          term_ja: "マグロ",
          reading: "まぐろ",
          term_en: "Tuna",
          term_zh: "金枪鱼",
          category: "sushi",
          subcategory: "akami",
          priority: "1",
          notes: "",
        },
      ];

      // 料理法データ
      const cookingRows = [
        {
          Japanese: "炙り焼き",
          English: "seared",
          Chinese_simplified: "炙烤",
          Category: "cooking_method",
        },
      ];

      // 変換
      const dishData = consolidator.convertDishData(dishRows);
      const cookingMethodData =
        consolidator.convertCookingMethodData(cookingRows);

      // 統合
      const consolidated = consolidator.consolidateData(
        dishData,
        cookingMethodData
      );

      expect(consolidated).toHaveLength(2);
      expect(consolidated[0].term_ja).toBe("マグロ"); // 優先度1
      expect(consolidated[1].term_ja).toBe("炙り焼き"); // 優先度100
    });

    test("重複データの処理", () => {
      const dishRows = [
        {
          id: "item_001",
          term_ja: "唐揚げ",
          reading: "からあげ",
          term_en: "karaage",
          term_zh: "日式炸鸡",
          category: "dish",
          subcategory: "",
          priority: "1",
          notes: "",
        },
      ];

      const cookingRows = [
        {
          Japanese: "唐揚げ",
          English: "fried chicken",
          Chinese_simplified: "炸鸡",
          Category: "dish_type",
        },
      ];

      const dishData = consolidator.convertDishData(dishRows);
      const cookingMethodData =
        consolidator.convertCookingMethodData(cookingRows);

      const consolidated = consolidator.consolidateData(
        dishData,
        cookingMethodData
      );

      // 重複が削除され、最初の出現のみ保持
      expect(consolidated).toHaveLength(1);
      expect(consolidated[0].term_ja).toBe("唐揚げ");
      expect(consolidated[0].term_en).toBe("karaage"); // 料理データの翻訳
      expect(consolidated[0].priority).toBe(1); // 料理データの優先度
    });
  });
});
