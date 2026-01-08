/**
 * 形態素解析モジュールのテスト
 */

const morphological = require("../morphological");

describe("形態素解析モジュール", () => {
  describe("tokenize", () => {
    test("日本語テキストを形態素に分解できる", async () => {
      const text = "唐揚げ定食を注文します";
      const tokens = await morphological.tokenize(text);

      expect(tokens).toBeInstanceOf(Array);
      expect(tokens.length).toBeGreaterThan(0);

      // 最初のトークンの構造を確認
      expect(tokens[0]).toHaveProperty("surface_form");
      expect(tokens[0]).toHaveProperty("pos");
    });

    test("空文字列の場合は空配列を返す", async () => {
      const tokens = await morphological.tokenize("");
      expect(tokens).toEqual([]);
    });

    test("nullの場合は空配列を返す", async () => {
      const tokens = await morphological.tokenize(null);
      expect(tokens).toEqual([]);
    });
  });

  describe("extractNouns", () => {
    test("名詞のみを抽出できる", async () => {
      const text = "美味しい唐揚げを食べる";
      const tokens = await morphological.tokenize(text);
      const nouns = morphological.extractNouns(tokens);

      expect(nouns.length).toBeGreaterThan(0);
      nouns.forEach((noun) => {
        expect(noun.pos).toBe("名詞");
      });
    });
  });

  describe("extractCompoundNouns", () => {
    test("複合名詞を抽出できる", async () => {
      const text = "唐揚げ定食セット";
      const tokens = await morphological.tokenize(text);
      const compounds = morphological.extractCompoundNouns(tokens);

      expect(compounds.length).toBeGreaterThan(0);
      expect(compounds[0]).toHaveProperty("surface");
      expect(compounds[0]).toHaveProperty("tokens");
    });

    test("単独の名詞は複合名詞として抽出されない", async () => {
      const text = "これは美味しいです";
      const tokens = await morphological.tokenize(text);
      const compounds = morphological.extractCompoundNouns(tokens);

      // 連続する名詞が2つ以上ない場合は空
      expect(compounds.length).toBe(0);
    });
  });

  describe("extractKeywords", () => {
    test("名詞、動詞、形容詞を抽出できる", async () => {
      const text = "美味しい唐揚げを食べる";
      const tokens = await morphological.tokenize(text);
      const keywords = morphological.extractKeywords(tokens);

      expect(keywords.length).toBeGreaterThan(0);
      keywords.forEach((keyword) => {
        expect(["名詞", "動詞", "形容詞"]).toContain(keyword.pos);
      });
    });
  });

  describe("extractSpecializedTermCandidates", () => {
    test("料理名から専門用語候補を抽出できる", async () => {
      const text = "唐揚げ定食とラーメンセット";
      const candidates =
        await morphological.extractSpecializedTermCandidates(text);

      expect(candidates.length).toBeGreaterThan(0);

      // 複合名詞が含まれているか
      const compoundNouns = candidates.filter(
        (c) => c.type === "compound_noun"
      );
      expect(compoundNouns.length).toBeGreaterThan(0);
    });

    test("カタカナ語を高優先度で抽出できる", async () => {
      const text = "ハンバーグステーキ";
      const candidates =
        await morphological.extractSpecializedTermCandidates(text);

      const katakanaTerms = candidates.filter(
        (c) => c.type === "katakana_noun"
      );
      expect(katakanaTerms.length).toBeGreaterThan(0);
    });

    test("優先度順にソートされている", async () => {
      const text = "美味しい唐揚げ定食とラーメン";
      const candidates =
        await morphological.extractSpecializedTermCandidates(text);

      // 優先度が昇順になっているか確認
      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i].priority).toBeGreaterThanOrEqual(
          candidates[i - 1].priority
        );
      }
    });
  });

  describe("getTextStats", () => {
    test("テキスト統計を取得できる", async () => {
      const text = "美味しい唐揚げを食べる";
      const stats = await morphological.getTextStats(text);

      expect(stats).toHaveProperty("total_tokens");
      expect(stats).toHaveProperty("nouns");
      expect(stats).toHaveProperty("verbs");
      expect(stats).toHaveProperty("adjectives");
      expect(stats).toHaveProperty("particles");
      expect(stats).toHaveProperty("unique_word_count");

      expect(stats.total_tokens).toBeGreaterThan(0);
      expect(stats.nouns).toBeGreaterThan(0);
    });
  });

  describe("normalizeText", () => {
    test("活用形を基本形に正規化できる", async () => {
      const text = "食べます";
      const normalized = await morphological.normalizeText(text);

      // 「食べます」→「食べる」または「食べる」+「ます」
      expect(normalized).toContain("食べる");
    });
  });

  describe("実際の料理名でのテスト", () => {
    test("複雑な料理名を解析できる", async () => {
      const dishes = [
        "鶏の唐揚げ定食",
        "海鮮丼セット",
        "カルボナーラスパゲッティ",
        "牛タン焼き",
      ];

      for (const dish of dishes) {
        const candidates =
          await morphological.extractSpecializedTermCandidates(dish);
        expect(candidates.length).toBeGreaterThan(0);

        // 少なくとも1つは複合名詞または名詞が抽出される
        const hasRelevantTerms = candidates.some(
          (c) =>
            c.type === "compound_noun" ||
            c.type === "katakana_noun" ||
            c.type === "general_noun"
        );
        expect(hasRelevantTerms).toBe(true);
      }
    });

    test("アレルゲン情報を含むテキストを解析できる", async () => {
      const text = "小麦、卵、乳成分を含みます";
      const tokens = await morphological.tokenize(text);
      const nouns = morphological.extractNouns(tokens);

      const allergenNouns = nouns.filter((n) =>
        ["小麦", "卵", "乳"].some((a) => n.surface_form.includes(a))
      );
      expect(allergenNouns.length).toBeGreaterThan(0);
    });
  });
});
