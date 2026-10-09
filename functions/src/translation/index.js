/**
 * 翻訳システム - Cloud Functions
 *
 * 専門用語辞書と翻訳APIを組み合わせたハイブリッド翻訳システム
 */

const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const morphological = require("../morphological");
const synonyms = require("../morphological/synonyms");

const db = admin.firestore();

// DeepL API設定（環境変数から取得）
const requireDeepLKey = () => {
  const key = process.env.DEEPL_API_KEY;
  if (!key || !key.trim())
    throw new HttpsError("failed-precondition", "翻訳APIの設定がありません。", {
      reason: "translation_not_configured",
    });
  return key;
};

// ===== ユーティリティ関数 =====

/**
 * キャッシュIDを生成
 * @param {string} sourceText - 翻訳元テキスト
 * @param {string} targetLang - 翻訳先言語コード
 * @return {string} - SHA256ハッシュ値
 */
const generateCacheId = (sourceText, targetLang) => {
  const input = `${sourceText}_${targetLang}`;
  return crypto.createHash("sha256").update(input).digest("hex");
};

/**
 * 辞書データを読み込み（キャッシュ付き）
 * @return {Promise<Array>} - 辞書データの配列
 */
let dictionaryCache = null;
let dictionaryCacheTime = null;
const DICTIONARY_CACHE_TTL = 5 * 60 * 1000; // 5分

const loadDictionary = async () => {
  const now = Date.now();

  if (
    dictionaryCache &&
    dictionaryCacheTime &&
    now - dictionaryCacheTime < DICTIONARY_CACHE_TTL
  ) {
    return dictionaryCache;
  }

  const snapshot = await db
    .collection("dictionary")
    .orderBy("priority", "asc")
    .get();

  dictionaryCache = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  dictionaryCacheTime = now;

  return dictionaryCache;
};

/**
 * 専門用語をテキストから抽出（形態素解析と類義語検出を使用）
 * @param {string} text - 検索対象テキスト
 * @return {Promise<Array>} - 抽出された専門用語の配列
 */
const findSpecializedTerms = async (text) => {
  const dictionary = await loadDictionary();
  const foundTerms = [];
  const seenTerms = new Set();

  // 形態素解析で専門用語候補を抽出
  const candidates = await morphological.extractSpecializedTermCandidates(text);

  // 辞書と照合（完全一致）
  dictionary.forEach((entry) => {
    if (text.includes(entry.term_ja)) {
      foundTerms.push({
        ...entry,
        matchType: "exact",
      });
      seenTerms.add(entry.term_ja);
    }
  });

  // 形態素解析の候補と辞書を照合（部分一致）
  candidates.forEach((candidate) => {
    dictionary.forEach((entry) => {
      if (seenTerms.has(entry.term_ja)) return;

      if (
        candidate.term.includes(entry.term_ja) ||
        entry.term_ja.includes(candidate.term)
      ) {
        foundTerms.push({
          ...entry,
          matchType: "partial",
          candidate: candidate.term,
        });
        seenTerms.add(entry.term_ja);
      }
    });
  });

  // 類義語検出（表記揺れを検出）
  candidates.forEach((candidate) => {
    const synonymMatches = synonyms.findSynonyms(candidate.term, dictionary, {
      maxResults: 5,
      minConfidence: 0.75,
    });

    synonymMatches.forEach((match) => {
      if (seenTerms.has(match.matchedTerm)) return;

      foundTerms.push({
        ...match,
        matchType: `synonym_${match.matchType}`,
        candidate: candidate.term,
      });
      seenTerms.add(match.matchedTerm);
    });
  });

  // 優先度順にソート（低い数字が高優先度）
  return foundTerms.sort((a, b) => a.priority - b.priority);
};

/**
 * キャッシュをチェック
 * @param {string} sourceText - 翻訳元テキスト
 * @param {string} targetLang - 翻訳先言語コード
 * @return {Promise<string|null>} - キャッシュされた翻訳テキスト
 */
const checkCache = async (sourceText, targetLang) => {
  const cacheId = generateCacheId(sourceText, targetLang);

  try {
    const cacheDoc = await db
      .collection("translation_cache")
      .doc(cacheId)
      .get();

    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data();

      // 有効期限チェック
      const expiry = cacheData.expires_at?.toDate
        ? cacheData.expires_at.toDate()
        : cacheData.expires_at;
      if (expiry instanceof Date && expiry > new Date()) {
        // ヒットカウントを更新
        await db
          .collection("translation_cache")
          .doc(cacheId)
          .update({
            hit_count: admin.firestore.FieldValue.increment(1),
            last_accessed_at: admin.firestore.FieldValue.serverTimestamp(),
          });

        return {
          translatedText: cacheData.translated_text,
          method: cacheData.translation_method,
          status: cacheData.status || "ready",
          foundTermsCount: cacheData.found_terms_count || 0,
          usedDictionary: cacheData.used_dictionary === true,
        };
      }
    }
  } catch (error) {
    console.error("Cache check error:", error);
  }

  return null;
};

/**
 * キャッシュに保存
 * @param {string} sourceText - 翻訳元テキスト
 * @param {string} targetLang - 翻訳先言語コード
 * @param {string} translatedText - 翻訳後テキスト
 * @param {string} method - 翻訳方法
 * @return {Promise<void>}
 */
const saveToCache = async (sourceText, targetLang, result) => {
  const cacheId = generateCacheId(sourceText, targetLang);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30日後

  try {
    await db.collection("translation_cache").doc(cacheId).set({
      source_text: sourceText,
      source_lang: "ja",
      target_lang: targetLang,
      translated_text: result.translatedText,
      translation_method: result.method,
      status: result.status,
      found_terms_count: result.foundTermsCount,
      used_dictionary: result.usedDictionary,
      hit_count: 0,
      expires_at: expiresAt,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      last_accessed_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Cache save error:", error);
  }
};

/**
 * DeepL APIで翻訳
 * @param {string} text - 翻訳対象テキスト
 * @param {string} targetLang - 翻訳先言語コード
 * @return {Promise<string>} - 翻訳後テキスト
 */
const translateWithDeepL = async (text, targetLang) => {
  const key = requireDeepLKey();

  const deepl = require("deepl-node");
  const translator = new deepl.Translator(key);

  // DeepLの言語コード変換
  const targetLangCode = targetLang === "zh" ? "ZH" : targetLang.toUpperCase();

  try {
    const result = await translator.translateText(text, "JA", targetLangCode);
    if (!result || typeof result.text !== "string" || !result.text.trim())
      throw new Error("Empty translation");
    return result.text;
  } catch {
    // Do not expose SDK errors that may contain request credentials.
    throw new HttpsError(
      "unavailable",
      "翻訳APIに接続できません。時間を置いて再実行してください。",
      { reason: "translation_api_unavailable" }
    );
  }
};

/**
 * 辞書ベースで翻訳結果を補正
 * @param {string} translatedText - 翻訳後テキスト
 * @param {Array} foundTerms - 抽出された専門用語
 * @param {string} targetLang - 翻訳先言語コード
 * @return {string} - 補正後テキスト
 */
const postProcessTranslation = (translatedText, foundTerms, targetLang) => {
  let correctedText = translatedText;

  foundTerms.forEach((term) => {
    const expectedTranslation =
      targetLang === "en" ? term.term_en : term.term_zh;

    if (!expectedTranslation) return;

    // 優先度が高い用語（1-2）のみ強制補正
    if (term.priority <= 2) {
      // 大文字小文字を無視して検索・置換
      const escapedTerm = expectedTranslation.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      const regex = new RegExp(escapedTerm, "gi");
      correctedText = correctedText.replace(regex, expectedTranslation);
    }
  });

  return correctedText;
};

/**
 * 辞書のみで翻訳（フォールバック用）
 * @param {string} text - 翻訳対象テキスト
 * @param {string} targetLang - 翻訳先言語コード
 * @return {Promise<string|null>} - 翻訳後テキスト（失敗時null）
 */
const translateWithDictionaryOnly = async (text, targetLang) => {
  const foundTerms = await findSpecializedTerms(text);

  if (foundTerms.length === 0) {
    return null;
  }

  let translatedText = text;

  foundTerms.forEach((term) => {
    const translation = targetLang === "en" ? term.term_en : term.term_zh;
    if (translation) {
      translatedText = translatedText.replace(
        new RegExp(term.term_ja, "g"),
        translation
      );
    }
  });

  return translatedText !== text ? translatedText : null;
};

// Single and batch requests deliberately share validation, bypasses and metadata.
const validateTranslation = (text, targetLang, useDictionary) => {
  if (typeof text !== "string" || !text.trim() || text.length > 10000)
    throw new HttpsError(
      "invalid-argument",
      "1〜10000文字のテキストが必要です"
    );
  if (!["en", "zh"].includes(targetLang))
    throw new HttpsError("invalid-argument", "サポートされていない言語です");
  if (typeof useDictionary !== "boolean")
    throw new HttpsError("invalid-argument", "辞書使用の指定が不正です");
};
const translate = async (
  text,
  targetLang,
  useDictionary,
  allowFallback = false
) => {
  validateTranslation(text, targetLang, useDictionary);
  if (/^[\d\s]+$/.test(text))
    return {
      translatedText: text,
      fromCache: false,
      method: "passthrough",
      status: "ready",
      foundTermsCount: 0,
      usedDictionary: false,
    };

  const cacheKey = `v2:${useDictionary ? "dictionary" : "deepl_only"}:${text}`;
  const cached = await checkCache(cacheKey, targetLang);
  if (cached) return { ...cached, fromCache: true };
  const foundTerms = useDictionary ? await findSpecializedTerms(text) : [];
  let translatedText;
  let method = useDictionary ? "deepl_api" : "deepl_only";
  try {
    translatedText = await translateWithDeepL(text, targetLang);
  } catch (error) {
    if (
      !allowFallback ||
      !useDictionary ||
      error.code === "failed-precondition"
    )
      throw error;
    translatedText = await translateWithDictionaryOnly(text, targetLang);
    if (!translatedText) throw error;
    return {
      translatedText,
      fromCache: false,
      method: "dictionary_fallback",
      status: "partial",
      foundTermsCount: foundTerms.length,
      usedDictionary: true,
    };
  }
  if (useDictionary && foundTerms.length) {
    translatedText = postProcessTranslation(
      translatedText,
      foundTerms,
      targetLang
    );
    method = "hybrid";
  }
  const result = {
    translatedText,
    method,
    status: "ready",
    foundTermsCount: foundTerms.length,
    usedDictionary: useDictionary && foundTerms.length > 0,
  };
  await saveToCache(cacheKey, targetLang, result);
  return { ...result, fromCache: false };
};

exports.translateText = onCall(
  { region: "asia-northeast1", secrets: ["DEEPL_API_KEY"], memory: "512MiB" },
  async (request) => {
    const { text, targetLang, useDictionary = true } = request.data || {};
    return translate(text, targetLang, useDictionary, true);
  }
);

const {
  requireStaff,
  requireRestaurant,
  isDocumentId,
} = require("../utils/staffAuth");
exports.batchTranslateMenu = onCall(
  { region: "asia-northeast1", secrets: ["DEEPL_API_KEY"] },
  async (request) => {
    const staffRestaurantId = requireStaff(request);
    const {
      restaurantId,
      targetLang,
      generateBothModes = false,
    } = request.data || {};
    if (!isDocumentId(restaurantId))
      throw new HttpsError("invalid-argument", "レストランIDが必要です");
    requireRestaurant(staffRestaurantId, restaurantId);
    if (
      !["en", "zh"].includes(targetLang) ||
      typeof generateBothModes !== "boolean"
    )
      throw new HttpsError("invalid-argument", "翻訳条件が不正です");
    requireDeepLKey();

    const menuSnapshot = await db
      .collection("restaurants")
      .doc(restaurantId)
      .collection("menu_items")
      .get();
    const batch = db.batch();
    const results = [];
    for (const doc of menuSnapshot.docs) {
      const menuItem = doc.data();
      const updateData = {};
      for (const field of ["name", "description"]) {
        const source = menuItem[`${field}_ja`];
        if (!source) continue;
        for (const useDictionary of generateBothModes
          ? [true, false]
          : [true]) {
          const result = await translate(source, targetLang, useDictionary);
          const key = `${field}_${targetLang}${useDictionary ? "" : "_nodic"}`;
          updateData[key] = result.translatedText;
          updateData[`${key}_translation`] = {
            method: result.method,
            status: result.status,
            usedDictionary: result.usedDictionary,
            foundTermsCount: result.foundTermsCount,
          };
        }
      }
      if (Object.keys(updateData).length) {
        batch.update(doc.ref, updateData);
        results.push({ id: doc.id, ...updateData });
      }
    }
    await batch.commit();
    return { count: results.length, items: results };
  }
);
