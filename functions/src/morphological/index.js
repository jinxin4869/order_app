/**
 * 形態素解析モジュール - kuromoji.js
 *
 * 日本語テキストの形態素解析を行い、専門用語の抽出や翻訳の精度向上に利用
 */

const kuromoji = require("kuromoji");
const path = require("path");

// kuromoji辞書のビルダー（シングルトン）
let tokenizerPromise = null;

/**
 * kuromoji tokenizerを初期化（遅延初期化、キャッシュ付き）
 * @return {Promise<Object>} - tokenizer
 */
const getTokenizer = () => {
  if (tokenizerPromise) {
    return tokenizerPromise;
  }

  tokenizerPromise = new Promise((resolve, reject) => {
    // kuromoji辞書のパス（node_modules内）
    const dicPath = path.join(
        __dirname,
        "../../node_modules/kuromoji/dict",
    );

    kuromoji
        .builder({dicPath})
        .build((err, tokenizer) => {
          if (err) {
            reject(err);
          } else {
            resolve(tokenizer);
          }
        });
  });

  return tokenizerPromise;
};

/**
 * テキストを形態素解析
 * @param {string} text - 解析対象テキスト
 * @return {Promise<Array>} - 形態素の配列
 */
const tokenize = async (text) => {
  if (!text || typeof text !== "string") {
    return [];
  }

  try {
    const tokenizer = await getTokenizer();
    const tokens = tokenizer.tokenize(text);
    return tokens;
  } catch (error) {
    console.error("Tokenization error:", error);
    return [];
  }
};

/**
 * 名詞を抽出
 * @param {Array} tokens - 形態素の配列
 * @return {Array} - 名詞のみの配列
 */
const extractNouns = (tokens) => {
  return tokens.filter((token) => {
    // 品詞が名詞で始まる
    return token.pos === "名詞";
  });
};

/**
 * 複合語（連続する名詞）を抽出
 * @param {Array} tokens - 形態素の配列
 * @return {Array} - 複合語の配列 [{surface: string, start: number, end: number}]
 */
const extractCompoundNouns = (tokens) => {
  const compounds = [];
  let currentCompound = [];

  tokens.forEach((token, index) => {
    if (token.pos === "名詞") {
      currentCompound.push(token);
    } else {
      if (currentCompound.length >= 2) {
        // 2語以上の名詞が連続している
        compounds.push({
          surface: currentCompound.map((t) => t.surface_form).join(""),
          tokens: currentCompound,
          start: tokens.indexOf(currentCompound[0]),
          end: index - 1,
        });
      }
      currentCompound = [];
    }
  });

  // 最後に残った複合語を処理
  if (currentCompound.length >= 2) {
    compounds.push({
      surface: currentCompound.map((t) => t.surface_form).join(""),
      tokens: currentCompound,
      start: tokens.indexOf(currentCompound[0]),
      end: tokens.length - 1,
    });
  }

  return compounds;
};

/**
 * キーワードを抽出（名詞、動詞、形容詞）
 * @param {Array} tokens - 形態素の配列
 * @return {Array} - キーワードの配列
 */
const extractKeywords = (tokens) => {
  return tokens.filter((token) => {
    const pos = token.pos;
    return pos === "名詞" || pos === "動詞" || pos === "形容詞";
  });
};

/**
 * 専門用語候補を抽出（料理名、食材名など）
 * @param {string} text - 解析対象テキスト
 * @return {Promise<Array>} - 専門用語候補の配列
 */
const extractSpecializedTermCandidates = async (text) => {
  const tokens = await tokenize(text);
  const candidates = [];

  // 1. 複合名詞を抽出（優先度高）
  const compounds = extractCompoundNouns(tokens);
  compounds.forEach((compound) => {
    candidates.push({
      term: compound.surface,
      type: "compound_noun",
      priority: 1,
      tokens: compound.tokens.map((t) => t.surface_form),
    });
  });

  // 2. 単独の名詞を抽出（カタカナ、固有名詞優先）
  const nouns = extractNouns(tokens);
  nouns.forEach((noun) => {
    const surface = noun.surface_form;

    // カタカナのみの名詞（外来語が多い）
    if (/^[ァ-ヶー]+$/.test(surface)) {
      candidates.push({
        term: surface,
        type: "katakana_noun",
        priority: 2,
        detail: noun.pos_detail_1,
      });
    }
    // 固有名詞
    else if (noun.pos_detail_1 === "固有名詞") {
      candidates.push({
        term: surface,
        type: "proper_noun",
        priority: 3,
        detail: noun.pos_detail_1,
      });
    }
    // 一般名詞（3文字以上）
    else if (surface.length >= 3) {
      candidates.push({
        term: surface,
        type: "general_noun",
        priority: 4,
        detail: noun.pos_detail_1,
      });
    }
  });

  // 優先度順にソート（低い数字が高優先度）
  return candidates.sort((a, b) => a.priority - b.priority);
};

/**
 * テキスト統計を取得
 * @param {string} text - 解析対象テキスト
 * @return {Promise<Object>} - 統計情報
 */
const getTextStats = async (text) => {
  const tokens = await tokenize(text);

  const stats = {
    total_tokens: tokens.length,
    nouns: 0,
    verbs: 0,
    adjectives: 0,
    particles: 0,
    unique_words: new Set(),
  };

  tokens.forEach((token) => {
    const pos = token.pos;

    if (pos === "名詞") stats.nouns++;
    else if (pos === "動詞") stats.verbs++;
    else if (pos === "形容詞") stats.adjectives++;
    else if (pos === "助詞") stats.particles++;

    stats.unique_words.add(token.basic_form || token.surface_form);
  });

  stats.unique_word_count = stats.unique_words.size;
  delete stats.unique_words; // Setは削除

  return stats;
};

/**
 * 表層形から基本形を取得
 * @param {string} text - 解析対象テキスト
 * @return {Promise<string>} - 基本形のテキスト
 */
const normalizeText = async (text) => {
  const tokens = await tokenize(text);
  return tokens
      .map((token) => token.basic_form || token.surface_form)
      .join("");
};

module.exports = {
  tokenize,
  extractNouns,
  extractCompoundNouns,
  extractKeywords,
  extractSpecializedTermCandidates,
  getTextStats,
  normalizeText,
};
