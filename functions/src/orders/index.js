/**
 * 注文処理 - Cloud Functions
 *
 * 注文の作成、更新、検証を行う
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

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

  const ordersToday = await db.collection("orders")
      .where("restaurant_id", "==", restaurantId)
      .where("created_at", ">=", startOfDay)
      .where("created_at", "<=", endOfDay)
      .get();

  const sequence = (ordersToday.size + 1).toString().padStart(3, "0");

  return `${dateStr}-${sequence}`;
};

/**
 * 注文データを検証
 * @param {Object} orderData - 注文データ
 * @return {Object} - {valid: boolean, errors: Array}
 */
const validateOrderData = (orderData) => {
  const errors = [];

  if (!orderData.restaurantId) {
    errors.push("Restaurant ID is required");
  }

  if (!orderData.tableId) {
    errors.push("Table ID is required");
  }

  if (!orderData.items || !Array.isArray(orderData.items) ||
      orderData.items.length === 0) {
    errors.push("At least one item is required");
  }

  if (orderData.items) {
    orderData.items.forEach((item, index) => {
      if (!item.item_id) {
        errors.push(`Item ${index + 1}: item_id is required`);
      }
      if (!item.quantity || item.quantity < 1 || item.quantity > 99) {
        errors.push(`Item ${index + 1}: quantity must be between 1 and 99`);
      }
      if (item.price === undefined || item.price < 0) {
        errors.push(`Item ${index + 1}: valid price is required`);
      }
      // 特別リクエストのバリデーション
      if (item.special_request && item.special_request.length > 200) {
        errors.push(`Item ${index + 1}: special request must be 200 characters or less`);
      }
      // XSS対策: HTMLタグを除去（サニタイゼーション）
      if (item.special_request) {
        item.special_request = item.special_request
            .replace(/<[^>]*>/g, "")
            .trim();
      }
    });
  }

  return errors;
};

/**
 * 金額計算を検証
 * @param {Object} orderData - 注文データ
 * @return {boolean} - 金額が正しければtrue
 */
const validatePriceCalculation = (orderData) => {
  const TAX_RATE = 0.10;

  const calculatedSubtotal = orderData.items.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0,
  );

  const calculatedTax = Math.floor(calculatedSubtotal * TAX_RATE);
  const calculatedTotal = calculatedSubtotal + calculatedTax;

  // 許容誤差1円
  const isValid =
    Math.abs(calculatedSubtotal - orderData.subtotal) <= 1 &&
    Math.abs(calculatedTax - orderData.tax) <= 1 &&
    Math.abs(calculatedTotal - orderData.totalAmount) <= 1;

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
exports.createOrder = functions
    .region("asia-northeast1")
    .https.onCall(async (data, context) => {
    // データ検証
      const validationErrors = validateOrderData(data);
      if (validationErrors.length > 0) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            validationErrors.join(", "),
        );
      }

      // 金額検証
      const priceValidation = validatePriceCalculation(data);
      if (!priceValidation.isValid) {
        console.warn("Price calculation mismatch:", {
          provided: {
            subtotal: data.subtotal,
            tax: data.tax,
            total: data.totalAmount,
          },
          calculated: priceValidation.calculated,
        });
      // 警告のみ、処理は続行
      }

      try {
      // レストランとテーブルの存在確認
        const restaurantDoc = await db
            .collection("restaurants")
            .doc(data.restaurantId)
            .get();

        if (!restaurantDoc.exists) {
          throw new functions.https.HttpsError(
              "not-found",
              "レストランが見つかりません",
          );
        }

        const tableDoc = await db
            .collection("restaurants")
            .doc(data.restaurantId)
            .collection("tables")
            .doc(data.tableId)
            .get();

        if (!tableDoc.exists) {
          throw new functions.https.HttpsError(
              "not-found",
              "テーブルが見つかりません",
          );
        }

        // 注文番号生成
        const orderNumber = await generateOrderNumber(data.restaurantId);

        // 注文データを作成
        const orderDoc = {
          restaurant_id: data.restaurantId,
          table_id: data.tableId,
          order_number: orderNumber,
          customer_language: data.customerLanguage || "ja",
          items: data.items.map((item) => ({
            item_id: item.item_id,
            name: item.name,
            name_ja: item.name_ja || item.name,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes || null,
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

        console.log(
            `Order created: ${orderRef.id}, Number: ${orderNumber}`,
        );

        return {
          orderId: orderRef.id,
          orderNumber: orderNumber,
        };
      } catch (error) {
        console.error("Create order error:", error);

        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        throw new functions.https.HttpsError(
            "internal",
            "注文の作成に失敗しました",
        );
      }
    });

/**
 * 注文ステータスを更新
 *
 * @param {Object} data - {orderId: string, newStatus: string}
 * @returns {Object} - {success: boolean}
 */
exports.updateOrderStatus = functions
    .region("asia-northeast1")
    .https.onCall(async (data, context) => {
      const {orderId, newStatus} = data;

      // バリデーション
      if (!orderId) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "注文IDが必要です",
        );
      }

      if (!Object.values(ORDER_STATUS).includes(newStatus)) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "無効なステータスです",
        );
      }

      try {
      // 注文を取得
        const orderRef = db.collection("orders").doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
          throw new functions.https.HttpsError(
              "not-found",
              "注文が見つかりません",
          );
        }

        const currentOrder = orderDoc.data();
        const currentStatus = currentOrder.status;

        // ステータス遷移の検証
        const validTransitions =
          VALID_STATUS_TRANSITIONS[currentStatus] || [];
        if (!validTransitions.includes(newStatus)) {
          throw new functions.https.HttpsError(
              "failed-precondition",
              `${currentStatus}から${newStatus}への変更はできません`,
          );
        }

        // 更新データを準備
        const updateData = {
          status: newStatus,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        // 特定のステータスではタイムスタンプを追加
        if (newStatus === ORDER_STATUS.CONFIRMED) {
          updateData.confirmed_at =
            admin.firestore.FieldValue.serverTimestamp();
        } else if (newStatus === ORDER_STATUS.COMPLETED) {
          updateData.completed_at =
            admin.firestore.FieldValue.serverTimestamp();
        }

        // ステータス更新
        await orderRef.update(updateData);

        console.log(
            `Order ${orderId} status: ${currentStatus} -> ${newStatus}`,
        );

        return {success: true};
      } catch (error) {
        console.error("Update order status error:", error);

        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        throw new functions.https.HttpsError(
            "internal",
            "注文ステータスの更新に失敗しました",
        );
      }
    });
