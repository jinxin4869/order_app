/**
 * 類義語検出モジュールのテスト
 */

const synonyms = require("../morphological/synonyms");

describe("類義語検出モジュール", () => {
  describe("normalizeText", () => {
    test("全角英数字を半角に変換", () => {
      const result = synonyms.normalizeText("ＡＢＣ１２３");
      expect(result).toBe("abc123");
    });

    test("長音記号を正規化", () => {
      const result = synonyms.normalizeText("ラ━メン");
      expect(result).toBe("ラーメン");
    });

    test("空白を削除", () => {
      const result = synonyms.normalizeText("唐 揚 げ");
      expect(result).toBe("唐揚げ");
    });

    test("複合的な正規化", () => {
      const result = synonyms.normalizeText("　ＡＢＣ　ラ━メン　");
      expect(result).toBe("abcラーメン");
    });
  });

  describe("katakanaToHiragana", () => {
    test("カタカナをひらがなに変換", () => {
      const result = synonyms.katakanaToHiragana("ラーメン");
      expect(result).toBe("らーめん");
    });

    test("カタカナ以外はそのまま", () => {
      const result = synonyms.katakanaToHiragana("唐揚げ");
      expect(result).toBe("唐揚げ");
    });
  });

  describe("hiraganaToKatakana", () => {
    test("ひらがなをカタカナに変換", () => {
      const result = synonyms.hiraganaToKatakana("らーめん");
      expect(result).toBe("ラーメン");
    });

    test("ひらがな以外はそのまま", () => {
      const result = synonyms.hiraganaToKatakana("唐揚げ");
      expect(result).toBe("唐揚げ");
    });
  });

  describe("areSynonyms", () => {
    test("完全一致は類義語", () => {
      const result = synonyms.areSynonyms("ラーメン", "ラーメン");
      expect(result.isSynonym).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.matchType).toBe("exact");
    });

    test("カタカナ・ひらがな変換後の一致", () => {
      const result = synonyms.areSynonyms("ラーメン", "らーめん");
      expect(result.isSynonym).toBe(true);
      expect(result.confidence).toBe(0.95);
      expect(result.matchType).toBe("kana_variant");
    });

    test("部分一致（含まれている）", () => {
      const result = synonyms.areSynonyms("唐揚げ定食", "唐揚げ");
      expect(result.isSynonym).toBe(true);
      expect(result.matchType).toBe("partial");
    });

    test("全く異なる用語は類義語ではない", () => {
      const result = synonyms.areSynonyms("ラーメン", "寿司");
      expect(result.isSynonym).toBe(false);
    });

    test("strictModeでは完全一致のみ", () => {
      const result = synonyms.areSynonyms("ラーメン", "らーめん", {
        strictMode: true,
      });
      expect(result.isSynonym).toBe(false);
    });

    test("類似度が閾値未満は類義語ではない", () => {
      const result = synonyms.areSynonyms("ラーメン", "うどん", {
        minSimilarity: 0.9,
      });
      expect(result.isSynonym).toBe(false);
    });
  });

  describe("calculateSimilarity", () => {
    test("同一文字列の類似度は1.0", () => {
      const similarity = synonyms.calculateSimilarity("ラーメン", "ラーメン");
      expect(similarity).toBe(1.0);
    });

    test("完全に異なる文字列の類似度は低い", () => {
      const similarity = synonyms.calculateSimilarity("ラーメン", "寿司");
      expect(similarity).toBeLessThan(0.5);
    });

    test("1文字違いの類似度は高い", () => {
      const similarity = synonyms.calculateSimilarity("ラーメン", "ラーメソ");
      expect(similarity).toBeGreaterThan(0.7);
    });
  });

  describe("levenshteinDistance", () => {
    test("同一文字列の編集距離は0", () => {
      const distance = synonyms.levenshteinDistance("test", "test");
      expect(distance).toBe(0);
    });

    test("1文字置換の編集距離は1", () => {
      const distance = synonyms.levenshteinDistance("test", "best");
      expect(distance).toBe(1);
    });

    test("1文字挿入の編集距離は1", () => {
      const distance = synonyms.levenshteinDistance("test", "tests");
      expect(distance).toBe(1);
    });

    test("1文字削除の編集距離は1", () => {
      const distance = synonyms.levenshteinDistance("test", "tes");
      expect(distance).toBe(1);
    });
  });

  describe("findSynonyms", () => {
    const mockDictionary = [
      { term_ja: "ラーメン", term_en: "Ramen", priority: 1 },
      { term_ja: "らーめん", term_en: "Ramen", priority: 2 },
      { term_ja: "拉麺", term_en: "Ramen", priority: 3 },
      { term_ja: "寿司", term_en: "Sushi", priority: 1 },
      { term_ja: "唐揚げ", term_en: "Karaage", priority: 1 },
    ];

    test("類義語を検索できる", () => {
      const results = synonyms.findSynonyms("ラーメン", mockDictionary);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].term_ja).toBe("ラーメン");
    });

    test("カタカナ・ひらがなの変換で類義語を検出", () => {
      const results = synonyms.findSynonyms("らーめん", mockDictionary);
      const ramenVariants = results.filter((r) => r.term_en === "Ramen");
      expect(ramenVariants.length).toBeGreaterThan(0);
    });

    test("maxResultsで結果数を制限", () => {
      const results = synonyms.findSynonyms("ラーメン", mockDictionary, {
        maxResults: 2,
      });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test("minConfidenceで信頼度の低いものを除外", () => {
      const results = synonyms.findSynonyms("ラーメン", mockDictionary, {
        minConfidence: 0.9,
      });
      results.forEach((result) => {
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    test("結果は信頼度順にソート", () => {
      const results = synonyms.findSynonyms("ラーメン", mockDictionary);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidence).toBeGreaterThanOrEqual(
          results[i].confidence
        );
      }
    });
  });

  describe("createSynonymGroups", () => {
    test("類義語をグループ化できる", () => {
      const terms = ["ラーメン", "らーめん", "寿司", "すし"];
      const groups = synonyms.createSynonymGroups(terms);

      expect(groups.length).toBeGreaterThan(0);

      // ラーメングループ
      const ramenGroup = groups.find((g) => g.variants.includes("ラーメン"));
      expect(ramenGroup).toBeDefined();
      expect(ramenGroup.variants).toContain("らーめん");
    });

    test("グループは出現数の降順", () => {
      const terms = ["ラーメン", "らーめん", "寿司"];
      const groups = synonyms.createSynonymGroups(terms);

      for (let i = 1; i < groups.length; i++) {
        expect(groups[i - 1].count).toBeGreaterThanOrEqual(groups[i].count);
      }
    });

    test("類義語がない場合は単独グループ", () => {
      const terms = ["ラーメン", "寿司", "唐揚げ"];
      const groups = synonyms.createSynonymGroups(terms, {
        minConfidence: 0.99,
      });

      // 類似度が非常に高い閾値なので、それぞれ単独グループ
      expect(groups.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("実際の料理用語での類義語検出", () => {
    test("ラーメンの表記揺れを検出", () => {
      const variants = ["ラーメン", "らーめん", "ラ━メン"];
      const results = [];

      for (let i = 0; i < variants.length; i++) {
        for (let j = i + 1; j < variants.length; j++) {
          const result = synonyms.areSynonyms(variants[i], variants[j]);
          if (result.isSynonym) {
            results.push({ term1: variants[i], term2: variants[j] });
          }
        }
      }

      expect(results.length).toBeGreaterThan(0);
    });

    test("寿司の表記揺れを検出", () => {
      const result = synonyms.areSynonyms("寿司", "すし");
      expect(result.isSynonym).toBe(true);
    });

    test("複合語の部分一致を検出", () => {
      const result = synonyms.areSynonyms("唐揚げ定食セット", "唐揚げ");
      expect(result.isSynonym).toBe(true);
      expect(result.matchType).toBe("partial");
    });
  });
});
