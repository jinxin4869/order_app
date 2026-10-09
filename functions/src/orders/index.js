/**
 * 注文処理 - Cloud Functions
 *
 * 注文の作成、更新、検証を行う
 */

const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  requireStaff,
  requireRestaurant,
  isDocumentId,
} = require("../utils/staffAuth");

const db = admin.firestore();
const { normalizeOrderInput } = require("../utils/orderInput");

// 注文ステータス定義
const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

// ステータス遷移の検証
const VALID_STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY]: [ORDER_STATUS.SERVED],
  [ORDER_STATUS.SERVED]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

/**
 * 注文番号を生成（日付 + シーケンス）
 * @param {string} restaurantId - レストランID
 * @return {Promise<string>} - 注文番号 (YYYYMMdd-XXX形式)
 */
const generateOrderNumber = async (restaurantId) => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  // 今日の注文数をカウント
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const ordersToday = await db
    .collection("orders")
    .where("restaurant_id", "==", restaurantId)
    .where("created_at", ">=", startOfDay)
    .where("created_at", "<=", endOfDay)
    .get();

  const sequence = (ordersToday.size + 1).toString().padStart(3, "0");

  return `${dateStr}-${sequence}`;
};

/**
 * 金額計算を検証
 * @param {Object} orderData - 注文データ
 * @return {boolean} - 金額が正しければtrue
 */
const validatePriceCalculation = (orderData) => {
  const TAX_RATE = 0.1;

  const calculatedSubtotal = orderData.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const calculatedTax = Math.floor(calculatedSubtotal * TAX_RATE);
  const calculatedTotal = calculatedSubtotal + calculatedTax;

  const isValid =
    calculatedSubtotal === orderData.subtotal &&
    calculatedTax === orderData.tax &&
    calculatedTotal === orderData.totalAmount;

  return {
    isValid,
    calculated: {
      subtotal: calculatedSubtotal,
      tax: calculatedTax,
      total: calculatedTotal,
    },
  };
};

// ===== Cloud Functions =====

/**
 * 注文を作成
 *
 * @param {Object} data - 注文データ
 * @returns {Object} - {orderId: string, orderNumber: string}
 */
exports.createOrder = onCall({ region: "asia-northeast1" }, async (request) => {
  const data = normalizeOrderInput(request.data);

  try {
    // レストランとテーブルの存在確認
    const restaurantDoc = await db
      .collection("restaurants")
      .doc(data.restaurantId)
      .get();

    if (!restaurantDoc.exists) {
      console.warn(
        `CreateOrder failed: Restaurant ${data.restaurantId} not found`
      );
      throw new HttpsError(
        "not-found",
        "指定されたレストランが見つかりません。"
      );
    }

    if (restaurantDoc.data().is_active !== true) {
      throw new HttpsError(
        "failed-precondition",
        "現在、この店舗は注文受付を停止しています。",
        { reason: "restaurant_closed" }
      );
    }

    const tableDoc = await db
      .collection("restaurants")
      .doc(data.restaurantId)
      .collection("tables")
      .doc(data.tableId)
      .get();

    if (!tableDoc.exists) {
      console.warn(
        `CreateOrder failed: Table ${data.tableId} not found in restaurant ${data.restaurantId}`
      );
      throw new HttpsError("not-found", "指定されたテーブルが見つかりません。");
    }

    const table = tableDoc.data();
    if (table.is_active === false || table.status === "unavailable") {
      throw new HttpsError(
        "failed-precondition",
        "このテーブルは現在利用できません。",
        { reason: "table_unavailable" }
      );
    }

    const itemDocs = await db.getAll(
      ...data.items.map((item) =>
        db
          .collection("restaurants")
          .doc(data.restaurantId)
          .collection("menu_items")
          .doc(item.item_id)
      )
    );
    const masterItems = itemDocs.map((doc, index) => {
      if (!doc.exists)
        throw new HttpsError("not-found", "商品が見つかりません。");
      const item = doc.data();
      if (item.is_available !== true)
        throw new HttpsError(
          "failed-precondition",
          "商品が品切れまたは販売停止中です。",
          { reason: "item_unavailable", itemId: doc.id }
        );
      if (
        !Number.isSafeInteger(item.price) ||
        item.price < 0 ||
        typeof item.name_ja !== "string" ||
        !item.name_ja.trim()
      ) {
        throw new HttpsError(
          "failed-precondition",
          "商品情報が未設定です。スタッフへお知らせください。",
          { reason: "invalid_catalog", itemId: doc.id }
        );
      }
      if (data.items[index].price !== item.price)
        throw new HttpsError(
          "failed-precondition",
          "商品価格が変更されています。メニューを更新してください。",
          { reason: "price_changed", itemId: doc.id, price: item.price }
        );

      return {
        ...data.items[index],
        price: item.price,
        name_ja: item.name_ja || "",
        name_en: item.name_en || null,
        name_zh: item.name_zh || null,
      };
    });

    const priceValidation = validatePriceCalculation({
      ...data,
      items: masterItems,
    });
    if (!priceValidation.isValid)
      throw new HttpsError("invalid-argument", "注文金額が一致しません。", {
        reason: "total_mismatch",
      });

    // 注文番号生成
    let orderNumber;
    try {
      orderNumber = await generateOrderNumber(data.restaurantId);
    } catch (e) {
      console.error("Order number generation failed:", e);
      throw new HttpsError(
        "internal",
        "注文番号の生成中にエラーが発生しました。"
      );
    }

    // 注文データを作成
    const orderDoc = {
      restaurant_id: data.restaurantId,
      table_id: data.tableId,
      order_number: orderNumber,
      customer_language: data.customerLanguage || "ja",
      items: masterItems.map((item) => ({
        ...item,
        name: item[`name_${data.customerLanguage}`] || item.name_ja,
      })),
      subtotal: priceValidation.calculated.subtotal,
      tax: priceValidation.calculated.tax,
      total_amount: priceValidation.calculated.total,
      status: ORDER_STATUS.PENDING,
      customer_notes: data.customerNotes || null,
      staff_notes: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      confirmed_at: null,
      completed_at: null,
    };

    // Firestoreに保存
    const orderRef = await db.collection("orders").add(orderDoc);

    // テーブルのステータスを更新
    await db
      .collection("restaurants")
      .doc(data.restaurantId)
      .collection("tables")
      .doc(data.tableId)
      .update({
        status: "occupied",
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log(`Order created: ${orderRef.id}, Number: ${orderNumber}`);

    return {
      success: true,
      orderId: orderRef.id,
      orderNumber: orderNumber,
    };
  } catch (error) {
    console.error(
      `Create order error for restaurant ${data.restaurantId}:`,
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
      "注文の作成中に予期せぬエラーが発生しました。"
    );
  }
});

/**
 * 注文ステータスを更新
 *
 * @param {Object} data - {orderId: string, newStatus: string}
 * @returns {Object} - {success: boolean}
 */
exports.updateOrderStatus = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const staffRestaurantId = requireStaff(request);
    const { orderId, newStatus } = request.data || {};

    // バリデーション
    if (!isDocumentId(orderId)) {
      throw new HttpsError("invalid-argument", "注文IDが必要です");
    }

    if (!Object.values(ORDER_STATUS).includes(newStatus)) {
      throw new HttpsError("invalid-argument", "無効なステータスです");
    }

    try {
      // 注文を取得
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        throw new HttpsError("not-found", "注文が見つかりません");
      }

      const currentOrder = orderDoc.data();
      requireRestaurant(staffRestaurantId, currentOrder.restaurant_id);
      const currentStatus = currentOrder.status;

      // ステータス遷移の検証
      const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      if (!validTransitions.includes(newStatus)) {
        throw new HttpsError(
          "failed-precondition",
          `${currentStatus}から${newStatus}への変更はできません`
        );
      }

      // 更新データを準備
      const updateData = {
        status: newStatus,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 特定のステータスではタイムスタンプを追加
      if (newStatus === ORDER_STATUS.CONFIRMED) {
        updateData.confirmed_at = admin.firestore.FieldValue.serverTimestamp();
      } else if (newStatus === ORDER_STATUS.COMPLETED) {
        updateData.completed_at = admin.firestore.FieldValue.serverTimestamp();
      }

      // ステータス更新
      await orderRef.update(updateData);

      console.log(`Order ${orderId} status: ${currentStatus} -> ${newStatus}`);

      return { success: true };
    } catch (error) {
      console.error(
        `Update order status error (ID: ${orderId}, NewStatus: ${newStatus}):`,
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
        "注文ステータスの更新中にエラーが発生しました。"
      );
    }
  }
);
