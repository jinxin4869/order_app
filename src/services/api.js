// Cloud Functions API サービス
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// ===== 翻訳関連 =====

/**
 * テキストを翻訳する
 * @param {string} text - 翻訳するテキスト
 * @param {string} targetLang - 翻訳先言語（'en' | 'zh'）
 * @returns {Promise<{translatedText: string, fromCache: boolean}>}
 */
export const translateText = async (text, targetLang) => {
  try {
    const translateFunction = httpsCallable(functions, "translateText");
    const result = await translateFunction({ text, targetLang });
    return result.data;
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
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
    const result = await batchFunction({ restaurantId, targetLang });
    return result.data;
  } catch (error) {
    console.error("Batch translation error:", error);
    throw error;
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
    const result = await createOrderFunction(orderData);
    return result.data;
  } catch (error) {
    console.error("Create order error:", error);
    throw error;
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
    const result = await updateFunction({ orderId, newStatus });
    return result.data;
  } catch (error) {
    console.error("Update order status error:", error);
    throw error;
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
    const result = await getMenuFunction({ restaurantId, language });
    return result.data;
  } catch (error) {
    console.error("Get menu error:", error);
    throw error;
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
    const result = await validateFunction({ qrData });
    return result.data;
  } catch (error) {
    console.error("QR validation error:", error);
    throw error;
  }
};
