// Cloud Functions API サービス
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { withRetry, handleError } from "../utils/errorHandler";
import { createRequestId } from "../utils/requestId";

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
    throw new Error(userMessage, { cause: error });
  }
};

/**
 * メニューを一括翻訳する（管理者用）
 * @param {string} restaurantId - レストランID
 * @param {string} targetLang - 翻訳先言語
 * @returns {Promise<{count: number, items: Array}>}
 */
export const batchTranslateMenu = async (
  restaurantId,
  targetLang,
  options = {}
) => {
  const { generateBothModes = false } = options;
  try {
    const batchFunction = httpsCallable(functions, "batchTranslateMenu");
    const result = await withRetry(
      () => batchFunction({ restaurantId, targetLang, generateBothModes }),
      2,
      1000
    );
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, {
      function: "batchTranslateMenu",
      params: { restaurantId, targetLang },
    });
    throw new Error(userMessage, { cause: error });
  }
};

// ===== 注文関連 =====

/**
 * 注文を作成する
 * @param {Object} orderData - 注文データ
 * @returns {Promise<{orderId: string, orderNumber: string}>}
 */
export const createOrder = async (orderData) => {
  const payload = {
    ...orderData,
    requestId: orderData.requestId || createRequestId(),
  };
  try {
    const createOrderFunction = httpsCallable(functions, "createOrder");
    const result = await withRetry(() => createOrderFunction(payload), 3, 1000);
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, {
      function: "createOrder",
      params: { itemCount: orderData.items?.length },
    });
    throw Object.assign(new Error(userMessage), {
      code: error.code,
      details: error.details,
    });
  }
};

/**
 * 送信結果が不明な注文が受け付けられたかを確認する
 * @returns {Promise<{accepted: boolean, orderId?: string, orderNumber?: string}>}
 */
export const getOrderRequest = async ({ restaurantId, tableId, requestId }) => {
  try {
    const check = httpsCallable(functions, "getOrderRequest");
    const result = await withRetry(
      () => check({ restaurantId, tableId, requestId }),
      2,
      1000
    );
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, { function: "getOrderRequest" });
    throw new Error(userMessage, { cause: error });
  }
};

/**
 * この端末が来店中に送った注文と進行状況を取得する
 * @returns {Promise<{closed: boolean, orders: Array}>}
 */
export const listVisitOrders = async ({ restaurantId, tableId, visitId }) => {
  try {
    const list = httpsCallable(functions, "listVisitOrders");
    const result = await withRetry(
      () => list({ restaurantId, tableId, visitId }),
      2,
      1000
    );
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, { function: "listVisitOrders" });
    throw new Error(userMessage, { cause: error });
  }
};

/**
 * スタッフがテーブルの来店を終了する（空席に戻し、注文履歴の参照を終える）
 */
export const closeTableVisit = async (tableId) => {
  try {
    const close = httpsCallable(functions, "closeTableVisit");
    const result = await close({ tableId });
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, { function: "closeTableVisit" });
    throw Object.assign(new Error(userMessage), { code: error.code });
  }
};

/**
 * 表示中のメニューの販売・受付状態だけを取得する（15秒ごとの確認用）
 * @returns {Promise<{ordering: "open"|"paused"|"invalid", soldOut: string[]}>}
 */
export const getMenuAvailability = async (restaurantId) => {
  const result = await httpsCallable(
    functions,
    "getMenuAvailability"
  )({ restaurantId });
  return result.data;
};

// ===== スタッフのメニュー管理 =====

export const getStaffMenu = async () => {
  const result = await httpsCallable(functions, "getStaffMenu")({});
  return result.data;
};
const staffChange = (name) => async (data) => {
  try {
    const result = await httpsCallable(functions, name)(data);
    return result.data;
  } catch (error) {
    throw Object.assign(new Error(handleError(error, { function: name })), {
      code: error.code,
      details: error.details,
    });
  }
};
export const setMenuItemAvailability = staffChange("setMenuItemAvailability");
export const setOrderingAvailability = staffChange("setOrderingAvailability");
export const correctOrderItems = staffChange("correctOrderItems");

/**
 * 注文ステータスを更新する
 * @param {string} orderId - 注文ID
 * @param {string} newStatus - 新しいステータス
 * @returns {Promise<{success: boolean}>}
 */
export const updateOrderStatus = async (
  orderId,
  newStatus,
  expectedStatus,
  reason
) => {
  try {
    const updateFunction = httpsCallable(functions, "updateOrderStatus");
    const result = await updateFunction({
      orderId,
      newStatus,
      expectedStatus,
      ...(reason ? { reason } : {}),
    });
    return result.data;
  } catch (error) {
    const userMessage = handleError(error, {
      function: "updateOrderStatus",
      params: { orderId, newStatus, expectedStatus },
    });
    throw Object.assign(new Error(userMessage), {
      code: error.code,
      details: error.details,
    });
  }
};

export const listStaffOrders = async (options = {}) => {
  const result = await httpsCallable(functions, "listStaffOrders")(options);
  return result.data;
};
export const getStaffOrder = async (orderId) => {
  const result = await httpsCallable(functions, "getStaffOrder")({ orderId });
  return result.data;
};

// ===== メニュー関連 =====

/**
 * メニューを取得する（翻訳付き）
 * @param {string} restaurantId - レストランID
 * @param {string} language - 言語コード
 * @returns {Promise<{categories: Array, items: Array}>}
 */
export const getMenuWithTranslation = async (restaurantId, language = "ja") => {
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
    throw new Error(userMessage, { cause: error });
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
    throw new Error(userMessage, { cause: error });
  }
};
