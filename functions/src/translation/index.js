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
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

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

  // 1. 形態素解析で専門用語候補を抽出
  const candidates = await morphological.extractSpecializedTermCandidates(text);

  // 2. 辞書と照合（完全一致）
  dictionary.forEach((entry) => {
    if (text.includes(entry.term_ja)) {
      foundTerms.push({
        ...entry,
        matchType: "exact",
      });
      seenTerms.add(entry.term_ja);
    }
  });

  // 3. 形態素解析の候補と辞書を照合（部分一致）
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

  // 4. 類義語検出（表記揺れを検出）
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
      if (cacheData.expires_at && cacheData.expires_at.toDate() > new Date()) {
        // ヒットカウントを更新
        await db
          .collection("translation_cache")
          .doc(cacheId)
          .update({
            hit_count: admin.firestore.FieldValue.increment(1),
            last_accessed_at: admin.firestore.FieldValue.serverTimestamp(),
          });

        return cacheData.translated_text;
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
const saveToCache = async (sourceText, targetLang, translatedText, method) => {
  const cacheId = generateCacheId(sourceText, targetLang);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30日後

  try {
    await db.collection("translation_cache").doc(cacheId).set({
      source_text: sourceText,
      source_lang: "ja",
      target_lang: targetLang,
      translated_text: translatedText,
      translation_method: method,
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
  if (!DEEPL_API_KEY) {
    throw new Error("DeepL API key not configured");
  }

  const deepl = require("deepl-node");
  const translator = new deepl.Translator(DEEPL_API_KEY);

  // DeepLの言語コード変換
  const targetLangCode = targetLang === "zh" ? "ZH" : targetLang.toUpperCase();

  const result = await translator.translateText(text, "JA", targetLangCode);
  return result.text;
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

// ===== Cloud Functions =====

/**
 * テキスト翻訳
 *
 * @param {Object} data - {text: string, targetLang: 'en' | 'zh', useDictionary?: boolean}
 * @param {string} data.text - 翻訳対象テキスト
 * @param {string} data.targetLang - 翻訳先言語コード ('en' | 'zh')
 * @param {boolean} [data.useDictionary=true] - 専門用語辞書を使用するかどうか（A/Bテスト用）
 * @returns {Object} - {translatedText: string, fromCache: boolean, method: string}
 */
exports.translateText = onCall(
  {
    region: "asia-northeast1",
    secrets: ["DEEPL_API_KEY"],
    memory: "512MiB",
  },
  async (request) => {
    const { text, targetLang, useDictionary = true } = request.data;

    // バリデーション
    if (!text || typeof text !== "string") {
      throw new HttpsError("invalid-argument", "テキストが必要です");
    }

    if (!["en", "zh"].includes(targetLang)) {
      throw new HttpsError("invalid-argument", "サポートされていない言語です");
    }

    // 短いテキストや数字のみの場合はそのまま返す
    if (text.length <= 2 || /^[\d\s]+$/.test(text)) {
      return { translatedText: text, fromCache: false };
    }

    try {
      // キャッシュキーに辞書使用フラグを含める（A/Bテスト時に別キャッシュとなる）
      const cacheKey = useDictionary ? text : `__nodic__${text}`;

      // Step 1: キャッシュチェック
      const cachedTranslation = await checkCache(cacheKey, targetLang);
      if (cachedTranslation) {
        return {
          translatedText: cachedTranslation,
          fromCache: true,
          method: useDictionary ? "hybrid_cached" : "deepl_only_cached",
        };
      }

      // Step 2: 専門用語を抽出（辞書使用時のみ）
      const foundTerms = useDictionary ? await findSpecializedTerms(text) : [];

      // Step 3: 翻訳API呼び出し
      let translatedText;
      let method = useDictionary ? "deepl_api" : "deepl_only";

      try {
        translatedText = await translateWithDeepL(text, targetLang);
      } catch (apiError) {
        console.error("DeepL API error:", apiError);

        // フォールバック: 辞書のみで翻訳（辞書使用時のみ）
        if (useDictionary) {
          translatedText = await translateWithDictionaryOnly(text, targetLang);
          method = "dictionary_only";
        }

        if (!translatedText) {
          // 最終フォールバック: 元のテキストを返す
          return {
            translatedText: text,
            fromCache: false,
            method: "fallback_original",
            error: "Translation failed",
          };
        }
      }

      // Step 4: 後処理（辞書ベース補正）- 辞書使用時のみ
      if (
        useDictionary &&
        foundTerms.length > 0 &&
        method !== "dictionary_only"
      ) {
        translatedText = postProcessTranslation(
          translatedText,
          foundTerms,
          targetLang
        );
        method = "hybrid";
      }

      // Step 5: キャッシュ保存
      await saveToCache(cacheKey, targetLang, translatedText, method);

      return {
        translatedText,
        fromCache: false,
        method,
        foundTermsCount: foundTerms.length,
        usedDictionary: useDictionary,
      };
    } catch (error) {
      console.error(
        `Translation error for text "${text}" to ${targetLang}:`,
        error
      );

      if (
        error instanceof HttpsError ||
        (error.code && typeof error.code === "string" && error.message)
      ) {
        throw error;
      }

      throw new HttpsError("internal", "翻訳処理中にエラーが発生しました。");
    }
  }
);

/**
 * メニュー一括翻訳（管理者用）
 *
 * @param {Object} data - {restaurantId: string, targetLang: 'en' | 'zh'}
 * @returns {Object} - {count: number, items: Array}
 */
exports.batchTranslateMenu = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const {
      restaurantId,
      targetLang,
      generateBothModes = false,
    } = request.data;

    // バリデーション
    if (!restaurantId) {
      throw new HttpsError("invalid-argument", "レストランIDが必要です");
    }

    if (!["en", "zh"].includes(targetLang)) {
      throw new HttpsError("invalid-argument", "サポートされていない言語です");
    }

    try {
      // メニュー取得
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

        // 名前を翻訳
        if (menuItem.name_ja) {
          // In v2, we need to call the function directly by importing it
          // For internal calls, we'll create a helper function or call the logic directly
          const cachedTranslation = await checkCache(
            menuItem.name_ja,
            targetLang
          );
          let nameTranslation;

          if (cachedTranslation) {
            nameTranslation = cachedTranslation;
          } else {
            const foundTerms = await findSpecializedTerms(menuItem.name_ja);
            try {
              nameTranslation = await translateWithDeepL(
                menuItem.name_ja,
                targetLang
              );
              if (foundTerms.length > 0) {
                nameTranslation = postProcessTranslation(
                  nameTranslation,
                  foundTerms,
                  targetLang
                );
              }
              await saveToCache(
                menuItem.name_ja,
                targetLang,
                nameTranslation,
                foundTerms.length > 0 ? "hybrid" : "deepl_api"
              );
            } catch (apiError) {
              nameTranslation =
                (await translateWithDictionaryOnly(
                  menuItem.name_ja,
                  targetLang
                )) || menuItem.name_ja;
            }
          }
          updateData[`name_${targetLang}`] = nameTranslation;

          // 辞書なし翻訳も生成（A/Bテスト用）
          if (generateBothModes) {
            const nodicCacheKey = `__nodic__${menuItem.name_ja}`;
            const cachedNodic = await checkCache(nodicCacheKey, targetLang);
            if (cachedNodic) {
              updateData[`name_${targetLang}_nodic`] = cachedNodic;
            } else {
              try {
                const nodicTranslation = await translateWithDeepL(
                  menuItem.name_ja,
                  targetLang
                );
                updateData[`name_${targetLang}_nodic`] = nodicTranslation;
                await saveToCache(
                  nodicCacheKey,
                  targetLang,
                  nodicTranslation,
                  "deepl_only"
                );
              } catch (apiError) {
                updateData[`name_${targetLang}_nodic`] = nameTranslation;
              }
            }
          }
        }

        // 説明を翻訳
        if (menuItem.description_ja) {
          const cachedTranslation = await checkCache(
            menuItem.description_ja,
            targetLang
          );
          let descTranslation;

          if (cachedTranslation) {
            descTranslation = cachedTranslation;
          } else {
            const foundTerms = await findSpecializedTerms(
              menuItem.description_ja
            );
            try {
              descTranslation = await translateWithDeepL(
                menuItem.description_ja,
                targetLang
              );
              if (foundTerms.length > 0) {
                descTranslation = postProcessTranslation(
                  descTranslation,
                  foundTerms,
                  targetLang
                );
              }
              await saveToCache(
                menuItem.description_ja,
                targetLang,
                descTranslation,
                foundTerms.length > 0 ? "hybrid" : "deepl_api"
              );
            } catch (apiError) {
              descTranslation =
                (await translateWithDictionaryOnly(
                  menuItem.description_ja,
                  targetLang
                )) || menuItem.description_ja;
            }
          }
          updateData[`description_${targetLang}`] = descTranslation;

          // 辞書なし翻訳も生成（A/Bテスト用）
          if (generateBothModes) {
            const nodicCacheKey = `__nodic__${menuItem.description_ja}`;
            const cachedNodic = await checkCache(nodicCacheKey, targetLang);
            if (cachedNodic) {
              updateData[`description_${targetLang}_nodic`] = cachedNodic;
            } else {
              try {
                const nodicTranslation = await translateWithDeepL(
                  menuItem.description_ja,
                  targetLang
                );
                updateData[`description_${targetLang}_nodic`] =
                  nodicTranslation;
                await saveToCache(
                  nodicCacheKey,
                  targetLang,
                  nodicTranslation,
                  "deepl_only"
                );
              } catch (apiError) {
                updateData[`description_${targetLang}_nodic`] = descTranslation;
              }
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          batch.update(doc.ref, updateData);
          results.push({ id: doc.id, ...updateData });
        }
      }

      await batch.commit();

      return {
        count: results.length,
        items: results,
      };
    } catch (error) {
      console.error(
        `Batch translation error for restaurant ${restaurantId}:`,
        error
      );

      if (
        error instanceof HttpsError ||
        (error.code && typeof error.code === "string" && error.message)
      ) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "メニューの一括翻訳中にエラーが発生しました。"
      );
    }
  }
);
