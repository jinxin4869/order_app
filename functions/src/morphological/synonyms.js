/**
 * 類義語検出モジュール
 *
 * 日本語の表記揺れや類義語を検出し、統一した用語に変換します
 * - カタカナ・ひらがなの変換（ラーメン ↔ らーめん）
 * - 漢字・カナの変換（拉麺 ↔ ラーメン）
 * - 長音記号の正規化（ラーメン ↔ ラ━メン）
 * - 読み仮名ベースのマッチング
 */

/**
 * カタカナをひらがなに変換
 * @param {string} str - 変換対象文字列
 * @return {string} - ひらがな文字列
 */
const katakanaToHiragana = (str) => {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
};

/**
 * ひらがなをカタカナに変換
 * @param {string} str - 変換対象文字列
 * @return {string} - カタカナ文字列
 */
const hiraganaToKatakana = (str) => {
  return str.replace(/[\u3041-\u3096]/g, (match) => {
    const chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
};

/**
 * 長音記号を正規化（ー、━、ｰ などを統一）
 * @param {string} str - 変換対象文字列
 * @return {string} - 正規化された文字列
 */
const normalizeProlongedSound = (str) => {
  // 全角・半角・罫線の長音記号を統一
  return str
      .replace(/━/g, "ー")
      .replace(/ｰ/g, "ー")
      .replace(/─/g, "ー");
};

/**
 * テキストを正規化（表記揺れを吸収）
 * @param {string} text - 正規化対象テキスト
 * @return {string} - 正規化されたテキスト
 */
const normalizeText = (text) => {
  if (!text || typeof text !== "string") return "";

  let normalized = text;

  // 1. 全角・半角の統一
  normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
  });

  // 2. 長音記号の正規化
  normalized = normalizeProlongedSound(normalized);

  // 3. 空白の削除
  normalized = normalized.replace(/\s+/g, "");

  // 4. 小文字化（英数字）
  normalized = normalized.toLowerCase();

  return normalized;
};

/**
 * 2つの用語が類義語かどうかを判定
 * @param {string} term1 - 用語1
 * @param {string} term2 - 用語2
 * @param {Object} options - オプション
 * @return {Object} - { isSynonym: boolean, confidence: number, matchType: string }
 */
const areSynonyms = (term1, term2, options = {}) => {
  const {
    strictMode = false, // 厳密モード（完全一致のみ）
    allowPartialMatch = true, // 部分一致を許可
    minSimilarity = 0.7, // 類似度の閾値
  } = options;

  if (!term1 || !term2) {
    return {isSynonym: false, confidence: 0, matchType: "none"};
  }

  // 正規化
  const norm1 = normalizeText(term1);
  const norm2 = normalizeText(term2);

  // 1. 完全一致（正規化後）
  if (norm1 === norm2) {
    return {isSynonym: true, confidence: 1.0, matchType: "exact"};
  }

  if (strictMode) {
    return {isSynonym: false, confidence: 0, matchType: "none"};
  }

  // 2. カタカナ・ひらがな変換後の一致
  const kana1Hiragana = katakanaToHiragana(norm1);
  const kana2Hiragana = katakanaToHiragana(norm2);

  if (kana1Hiragana === kana2Hiragana) {
    return {
      isSynonym: true,
      confidence: 0.95,
      matchType: "kana_variant",
    };
  }

  // 3. 部分一致（含まれている場合）
  if (allowPartialMatch) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const similarity = calculateSimilarity(norm1, norm2);
      if (similarity >= minSimilarity) {
        return {
          isSynonym: true,
          confidence: similarity,
          matchType: "partial",
        };
      }
    }
  }

  // 4. 編集距離ベースの類似度
  const similarity = calculateSimilarity(norm1, norm2);
  if (similarity >= minSimilarity) {
    return {
      isSynonym: true,
      confidence: similarity,
      matchType: "similar",
    };
  }

  return {isSynonym: false, confidence: similarity, matchType: "none"};
};

/**
 * 文字列の類似度を計算（Levenshtein距離ベース）
 * @param {string} str1 - 文字列1
 * @param {string} str2 - 文字列2
 * @return {number} - 類似度（0.0 - 1.0）
 */
const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

/**
 * Levenshtein距離を計算
 * @param {string} str1 - 文字列1
 * @param {string} str2 - 文字列2
 * @return {number} - 編集距離
 */
const levenshteinDistance = (str1, str2) => {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 置換
            matrix[i][j - 1] + 1, // 挿入
            matrix[i - 1][j] + 1, // 削除
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * 辞書から類義語を検索
 * @param {string} term - 検索する用語
 * @param {Array} dictionary - 辞書データ
 * @param {Object} options - オプション
 * @return {Array} - マッチした類義語のリスト
 */
const findSynonyms = (term, dictionary, options = {}) => {
  const {
    maxResults = 10,
    minConfidence = 0.7,
  } = options;

  const results = [];

  dictionary.forEach((entry) => {
    const termJa = entry.term_ja || entry.surface_form;
    if (!termJa) return;

    const synonymResult = areSynonyms(term, termJa, options);

    if (synonymResult.isSynonym && synonymResult.confidence >= minConfidence) {
      results.push({
        ...entry,
        matchType: synonymResult.matchType,
        confidence: synonymResult.confidence,
        originalTerm: term,
        matchedTerm: termJa,
      });
    }
  });

  // 信頼度でソート
  results.sort((a, b) => b.confidence - a.confidence);

  return results.slice(0, maxResults);
};

/**
 * テキスト内の類義語をすべて検出
 * @param {string} text - 検索対象テキスト
 * @param {Array} dictionary - 辞書データ
 * @param {Object} options - オプション
 * @return {Promise<Array>} - 検出された類義語のリスト
 */
const detectSynonymsInText = async (text, dictionary, options = {}) => {
  const morphological = require("./index");

  // 形態素解析で候補を抽出
  const candidates = await morphological.extractSpecializedTermCandidates(text);

  const allSynonyms = [];
  const seenTerms = new Set();

  // 各候補について類義語を検索
  candidates.forEach((candidate) => {
    const synonyms = findSynonyms(candidate.term, dictionary, options);

    synonyms.forEach((synonym) => {
      const key = `${synonym.matchedTerm}:${synonym.confidence}`;
      if (!seenTerms.has(key)) {
        seenTerms.add(key);
        allSynonyms.push({
          ...synonym,
          candidateInfo: {
            term: candidate.term,
            type: candidate.type,
            priority: candidate.priority,
          },
        });
      }
    });
  });

  // 信頼度でソート
  return allSynonyms.sort((a, b) => b.confidence - a.confidence);
};

/**
 * 類義語グループを作成（クラスタリング）
 * @param {Array} terms - 用語リスト
 * @param {Object} options - オプション
 * @return {Array} - 類義語グループ
 */
const createSynonymGroups = (terms, options = {}) => {
  const {minConfidence = 0.8} = options;

  const groups = [];
  const processed = new Set();

  terms.forEach((term) => {
    if (processed.has(term)) return;

    const group = [term];
    processed.add(term);

    // 他の用語と比較
    terms.forEach((otherTerm) => {
      if (processed.has(otherTerm)) return;

      const result = areSynonyms(term, otherTerm, {
        ...options,
        minSimilarity: minConfidence,
      });

      if (result.isSynonym) {
        group.push(otherTerm);
        processed.add(otherTerm);
      }
    });

    if (group.length > 0) {
      groups.push({
        canonical: group[0], // 代表形
        variants: group,
        count: group.length,
      });
    }
  });

  return groups.sort((a, b) => b.count - a.count);
};

module.exports = {
  katakanaToHiragana,
  hiraganaToKatakana,
  normalizeProlongedSound,
  normalizeText,
  areSynonyms,
  calculateSimilarity,
  levenshteinDistance,
  findSynonyms,
  detectSynonymsInText,
  createSynonymGroups,
};
