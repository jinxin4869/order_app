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
  const candidates = await morphological.extractSpecializedTermCandidates(text);
  const found = [];
  for (const entry of dictionary) {
    if (typeof entry.term_ja !== "string" || !entry.term_ja) continue;
    if (text.includes(entry.term_ja))
      found.push({ ...entry, source: entry.term_ja, matchType: "exact" });
  }
  for (const candidate of candidates) {
    if (!candidate.term || !text.includes(candidate.term)) continue;
    for (const match of synonyms.findSynonyms(candidate.term, dictionary, {
      minConfidence: 0.9,
      allowPartialMatch: false,
      reading1: candidate.reading,
    })) {
      // Similar spelling alone must never change the meaning of a dish.
      if (!["exact", "kana_variant", "reading"].includes(match.matchType))
        continue;
      found.push({ ...match, source: candidate.term });
    }
  }
  return found;
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
const translateWithDeepL = async (text, targetLang, options = {}) => {
  const key = requireDeepLKey();

  const deepl = require("deepl-node");
  const translator = new deepl.Translator(key);

  // DeepLの言語コード変換
  const targetLangCode = targetLang === "zh" ? "ZH" : targetLang.toUpperCase();

  try {
    const result = await translator.translateText(
      text,
      "JA",
      targetLangCode,
      options
    );
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

// Select literal spans, preferring longer compound names over component words.
// All replacements use offsets, so dictionary punctuation is never a regex.
const dictionarySpans = (text, foundTerms, targetLang) => {
  const matches = [];
  for (const term of foundTerms) {
    const translation = term[`term_${targetLang}`];
    if (typeof translation !== "string" || !translation.trim()) continue;
    let start = text.indexOf(term.source);
    while (start !== -1) {
      matches.push({
        start,
        end: start + term.source.length,
        translation,
        priority: term.priority || 100,
        term: term.term_ja,
      });
      start = text.indexOf(term.source, start + term.source.length);
    }
  }
  matches.sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      a.priority - b.priority ||
      a.start - b.start ||
      a.term.localeCompare(b.term)
  );
  const selected = [];
  for (const match of matches) {
    if (
      !selected.some(
        (other) => match.start < other.end && match.end > other.start
      )
    )
      selected.push(match);
  }
  return selected.sort((a, b) => a.start - b.start);
};
const escapeXML = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const decodeXML = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, name) => {
    if (name[0] !== "#")
      return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[
        name.toLowerCase()
      ];
    const point =
      name[1].toLowerCase() === "x"
        ? parseInt(name.slice(2), 16)
        : Number(name.slice(1));
    if (point < 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff))
      throw new HttpsError("unavailable", "翻訳結果の形式が不正です");
    return String.fromCodePoint(point);
  });
const replaceSpans = (text, spans, render) => {
  let output = "",
    offset = 0;
  spans.forEach((span, index) => {
    output += text.slice(offset, span.start) + render(span, index);
    offset = span.end;
  });
  return output + text.slice(offset);
};
const protectedTranslation = async (text, spans, targetLang) => {
  // DeepL's documented XML ignoreTags preserve our dictionary translations.
  // https://github.com/DeepL/deepl-node#text-translation-options
  let offset = 0,
    xml = "<menu_text>";
  spans.forEach((span, index) => {
    xml +=
      escapeXML(text.slice(offset, span.start)) +
      `<d${index}>${escapeXML(span.translation)}</d${index}>`;
    offset = span.end;
  });
  xml += escapeXML(text.slice(offset)) + "</menu_text>";
  const translated = await translateWithDeepL(xml, targetLang, {
    tagHandling: "xml",
    ignoreTags: spans.map((_, index) => `d${index}`),
  });
  const wrapper = translated
    .trim()
    .match(/^<menu_text>([\s\S]*)<\/menu_text>$/);
  if (!wrapper)
    throw new HttpsError("unavailable", "辞書適用結果を確認できません");
  let content = wrapper[1];
  for (let index = 0; index < spans.length; index++) {
    const pattern = new RegExp(`<d${index}>([\\s\\S]*?)</d${index}>`, "g");
    const tags = [...content.matchAll(pattern)];
    if (tags.length !== 1 || decodeXML(tags[0][1]) !== spans[index].translation)
      throw new HttpsError("unavailable", "辞書適用結果を確認できません");
    // Preserve encoded source characters until every generated tag is removed.
    content = content.replace(pattern, () =>
      escapeXML(spans[index].translation)
    );
  }
  if (/[<>]/.test(content))
    throw new HttpsError("unavailable", "翻訳結果の形式が不正です");
  return decodeXML(content);
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

  const foundTerms = useDictionary ? await findSpecializedTerms(text) : [];
  const spans = dictionarySpans(text, foundTerms, targetLang);
  const revision = crypto
    .createHash("sha256")
    .update(JSON.stringify(spans))
    .digest("hex");
  const cacheKey = `v3:${useDictionary ? `dictionary:${revision}` : "deepl_only"}:${text}`;
  const cached = await checkCache(cacheKey, targetLang);
  if (cached) return { ...cached, fromCache: true };
  let translatedText;
  let method = useDictionary ? "deepl_api" : "deepl_only";
  try {
    translatedText = spans.length
      ? await protectedTranslation(text, spans, targetLang)
      : await translateWithDeepL(text, targetLang);
  } catch (error) {
    if (
      !allowFallback ||
      !useDictionary ||
      error.code === "failed-precondition"
    )
      throw error;
    if (!spans.length) throw error;
    translatedText = replaceSpans(text, spans, (span) => span.translation);
    return {
      translatedText,
      fromCache: false,
      method: "dictionary_fallback",
      status: "partial",
      foundTermsCount: spans.length,
      usedDictionary: true,
    };
  }
  if (spans.length) method = "hybrid";
  const result = {
    translatedText,
    method,
    status: "ready",
    foundTermsCount: spans.length,
    usedDictionary: spans.length > 0,
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

    const storeRef = db.collection("restaurants").doc(restaurantId);
    const [menuSnapshot, categorySnapshot] = await Promise.all([
      storeRef.collection("menu_items").get(),
      storeRef.collection("menu_categories").get(),
    ]);
    const documents = [...menuSnapshot.docs, ...categorySnapshot.docs];
    if (documents.length > 450)
      throw new HttpsError(
        "resource-exhausted",
        "一括翻訳は料理・カテゴリ合計450件以下で実行してください"
      );
    const batch = db.batch();
    const results = [];
    for (const doc of documents) {
      const menuItem = doc.data();
      const updateData = {};
      for (const field of ["name", "description"]) {
        const source = menuItem[`${field}_ja`];
        if (!source) continue;
        for (const useDictionary of generateBothModes
          ? [true, false]
          : [true]) {
          let result;
          try {
            result = await translate(source, targetLang, useDictionary);
          } catch (error) {
            if (error instanceof HttpsError)
              throw new HttpsError(error.code, error.message, {
                ...error.details,
                field,
                mode: useDictionary ? "dictionary" : "deepl_only",
                documentPath: doc.ref.path,
                status: "failed",
              });
            throw new HttpsError("internal", "翻訳処理に失敗しました");
          }
          const key = `${field}_${targetLang}${useDictionary ? "" : "_nodic"}`;
          updateData[key] = result.translatedText;
          updateData[`${key}_translation`] = {
            schemaVersion: 1,
            sourceText: source,
            mode: useDictionary ? "dictionary" : "deepl_only",
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
