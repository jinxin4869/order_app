// Cloud Functions API サービス
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { withRetry, handleError } from "../utils/errorHandler";

// ===== 翻訳関連 =====

/**
 * テキストを翻訳する
 * @param {string} text - 翻訳するテキスト
 * @param {string} targetLang - 翻訳先言語（'en' | 'zh'）
 * @param {Object} options - オプション
 * @param {boolean} [options.useDictionary=true] - 専門用語辞書を使用するか（A/Bテスト用）
 * @returns {Promise<{translatedText: string, fromCache: boolean, method: string}>}
 */
export const translateText = async (text, targetLang, options = {}) => {
  const { useDictionary = true } = options;
  try {
    const translateFunction = httpsCallable(functions, "translateText");
    const result = await withRetry(
      () => translateFunction({ text, targetLang, useDictionary }),
      2,
      1000
    );
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, {
      function: "translateText",
      params: { text, targetLang, useDictionary },
    });
    throw new Error(userMessage);
  }
};

/**
 * メニューを一括翻訳する（管理者用）
 * @param {string} restaurantId - レストランID
 * @param {string} targetLang - 翻訳先言語
 * @returns {Promise<{count: number, items: Array}>}
 */
export const batchTranslateMenu = async (restaurantId, targetLang) => {
  try {
    const batchFunction = httpsCallable(functions, "batchTranslateMenu");
    const result = await withRetry(
      () => batchFunction({ restaurantId, targetLang }),
      2,
      1000
    );
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, {
      function: "batchTranslateMenu",
      params: { restaurantId, targetLang },
    });
    throw new Error(userMessage);
  }
};

// ===== 注文関連 =====

/**
 * 注文を作成する
 * @param {Object} orderData - 注文データ
 * @returns {Promise<{orderId: string, orderNumber: string}>}
 */
export const createOrder = async (orderData) => {
  try {
    const createOrderFunction = httpsCallable(functions, "createOrder");
    const result = await withRetry(
      () => createOrderFunction(orderData),
      3,
      1000
    );
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, {
      function: "createOrder",
      params: { itemCount: orderData.items?.length },
    });
    throw new Error(userMessage);
  }
};

/**
 * 注文ステータスを更新する
 * @param {string} orderId - 注文ID
 * @param {string} newStatus - 新しいステータス
 * @returns {Promise<{success: boolean}>}
 */
export const updateOrderStatus = async (orderId, newStatus) => {
  try {
    const updateFunction = httpsCallable(functions, "updateOrderStatus");
    const result = await withRetry(
      () => updateFunction({ orderId, newStatus }),
      2,
      1000
    );
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, {
      function: "updateOrderStatus",
      params: { orderId, newStatus },
    });
    throw new Error(userMessage);
  }
};

// ===== メニュー関連 =====

/**
 * メニューを取得する（翻訳付き）
 * @param {string} restaurantId - レストランID
 * @param {string} language - 言語コード
 * @returns {Promise<{categories: Array, items: Array}>}
 */
export const getMenuWithTranslation = async (restaurantId, language) => {
  try {
    const getMenuFunction = httpsCallable(functions, "getMenuWithTranslation");
    const result = await withRetry(
      () => getMenuFunction({ restaurantId, language }),
      3,
      1000
    );
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, {
      function: "getMenuWithTranslation",
      params: { restaurantId, language },
    });
    throw new Error(userMessage);
  }
};

// ===== QRコード検証 =====

/**
 * QRコードを検証する
 * @param {string} qrData - QRコードデータ（format: restaurantId/tableId）
 * @returns {Promise<{valid: boolean, restaurant?: Object, table?: Object}>}
 */
export const validateQRCode = async (qrData) => {
  try {
    const validateFunction = httpsCallable(functions, "validateQRCode");
    const result = await withRetry(() => validateFunction({ qrData }), 2, 1000);
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, {
      function: "validateQRCode",
      params: { qrData },
    });
    throw new Error(userMessage);
  }
};
