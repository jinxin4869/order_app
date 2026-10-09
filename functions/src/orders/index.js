/**
 * 注文処理 - Cloud Functions
 *
 * 注文の作成、更新、検証を行う
 */

const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { createHash } = require("node:crypto");
const {
  requireStaff,
  requireRestaurant,
  isDocumentId,
} = require("../utils/staffAuth");

const { businessDay } = require("../utils/businessDay");
const db = admin.firestore();
const { normalizeOrderInput } = require("../utils/orderInput");

const {
  ORDER_STATUS,
  VALID_STATUS_TRANSITIONS,
} = require("../utils/orderStatus");

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

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        restaurantId: data.restaurantId,
        tableId: data.tableId,
        customerLanguage: data.customerLanguage,
        customerNotes: data.customerNotes,
        items: data.items,
      })
    )
    .digest("hex");
  const requestKey = createHash("sha256")
    .update(JSON.stringify([data.restaurantId, data.tableId, data.requestId]))
    .digest("hex");
  const requestRef = db.collection("order_requests").doc(requestKey);
  const orderRef = db.collection("orders").doc();
  const restaurantRef = db.collection("restaurants").doc(data.restaurantId);
  const tableRef = restaurantRef.collection("tables").doc(data.tableId);
  try {
    return await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(requestRef);
      if (existing.exists) {
        const saved = existing.data();
        if (saved.fingerprint !== fingerprint)
          throw new HttpsError(
            "already-exists",
            "同じリクエストIDで異なる注文を送信することはできません。"
          );
        return saved.result;
      }
      // レストランとテーブルの存在確認
      const restaurantDoc = await transaction.get(restaurantRef);

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

      const tableDoc = await transaction.get(tableRef);

      if (!tableDoc.exists) {
        console.warn(
          `CreateOrder failed: Table ${data.tableId} not found in restaurant ${data.restaurantId}`
        );
        throw new HttpsError(
          "not-found",
          "指定されたテーブルが見つかりません。"
        );
      }

      const table = tableDoc.data();
      if (table.is_active === false || table.status === "unavailable") {
        throw new HttpsError(
          "failed-precondition",
          "このテーブルは現在利用できません。",
          { reason: "table_unavailable" }
        );
      }

      const itemDocs = await transaction.getAll(
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

      const day = businessDay();
      const counterRef = restaurantRef.collection("order_counters").doc(day);
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists) {
        // Never silently restart numbering after upgrading an existing store.
        const legacyOrders = await transaction.get(
          db
            .collection("orders")
            .where("restaurant_id", "==", data.restaurantId)
            .where("order_number", ">=", `${day}-`)
            .where("order_number", "<=", `${day}-\uf8ff`)
            .limit(1)
        );
        if (!legacyOrders.empty)
          throw new HttpsError(
            "failed-precondition",
            "本日の注文番号カウンターの初期設定が必要です。スタッフへお知らせください。",
            { reason: "counter_initialization_required" }
          );
      }
      const previous = counterDoc.exists ? counterDoc.data().last_sequence : 0;
      if (
        !Number.isSafeInteger(previous) ||
        previous < 0 ||
        previous >= Number.MAX_SAFE_INTEGER
      ) {
        throw new HttpsError(
          "failed-precondition",
          "注文番号カウンターの設定が無効です。"
        );
      }
      const sequence = previous + 1;
      const orderNumber = `${day}-${String(sequence).padStart(3, "0")}`;

      // 注文データを作成
      const orderDoc = {
        restaurant_id: data.restaurantId,
        table_id: data.tableId,
        order_number: orderNumber,
        business_day: day,
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

      const result = { success: true, orderId: orderRef.id, orderNumber };
      transaction.set(counterRef, {
        last_sequence: sequence,
        business_day: day,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(orderRef, orderDoc);
      transaction.set(requestRef, {
        restaurant_id: data.restaurantId,
        table_id: data.tableId,
        fingerprint,
        result,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(tableRef, {
        status: "occupied",
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return result;
    });
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
const orderDTO = (doc) => {
  const data = doc.data();
  const millis = (value) =>
    value?.toMillis
      ? value.toMillis()
      : value instanceof Date
        ? value.getTime()
        : null;
  return {
    id: doc.id,
    restaurant_id: data.restaurant_id,
    table_id: data.table_id,
    table_number: data.table_number || data.table_id,
    order_number: data.order_number,
    status: data.status,
    customer_language: data.customer_language,
    customer_notes: data.customer_notes || "",
    subtotal: data.subtotal,
    tax: data.tax,
    total_amount: data.total_amount,
    created_at: millis(data.created_at),
    updated_at: millis(data.updated_at),
    items: (data.items || []).map((item) => ({
      item_id: item.item_id,
      name_ja: item.name_ja,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes || "",
    })),
  };
};
const getStaffOrderRef = async (orderId, restaurantId) => {
  if (!isDocumentId(orderId))
    throw new HttpsError("invalid-argument", "注文IDが不正です");
  const doc = await db.collection("orders").doc(orderId).get();
  if (!doc.exists) throw new HttpsError("not-found", "注文が見つかりません");
  requireRestaurant(restaurantId, doc.data().restaurant_id);
  return doc;
};
exports.getStaffOrder = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const restaurantId = requireStaff(request);
    return {
      order: orderDTO(
        await getStaffOrderRef(request.data?.orderId, restaurantId)
      ),
    };
  }
);
exports.listStaffOrders = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const restaurantId = requireStaff(request);
    const { view = "active", cursor = null, limit = 50 } = request.data || {};
    if (
      !["active", "all"].includes(view) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new HttpsError("invalid-argument", "一覧の取得条件が不正です");
    let query = db
      .collection("orders")
      .where("restaurant_id", "==", restaurantId);
    if (view === "active")
      query = query.where("status", "in", [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "served",
      ]);
    query = query.orderBy("created_at", "desc").orderBy("__name__", "desc");
    if (cursor !== null) {
      const after = await getStaffOrderRef(cursor, restaurantId);
      if (!after.data().created_at)
        throw new HttpsError("invalid-argument", "一覧を再取得してください");
      query = query.startAfter(after);
    }
    const snapshot = await query.limit(limit + 1).get();
    const docs = snapshot.docs.slice(0, limit);
    return {
      restaurantId,
      orders: docs.map(orderDTO),
      hasMore: snapshot.docs.length > limit,
      cursor: docs.length ? docs[docs.length - 1].id : null,
    };
  }
);
exports.updateOrderStatus = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const restaurantId = requireStaff(request);
    const { orderId, newStatus, expectedStatus } = request.data || {};
    if (
      !isDocumentId(orderId) ||
      !Object.values(ORDER_STATUS).includes(newStatus) ||
      !Object.values(ORDER_STATUS).includes(expectedStatus)
    )
      throw new HttpsError(
        "invalid-argument",
        "注文IDと変更前後の状態が必要です"
      );
    const orderRef = db.collection("orders").doc(orderId);
    return db.runTransaction(async (transaction) => {
      const doc = await transaction.get(orderRef);
      if (!doc.exists)
        throw new HttpsError("not-found", "注文が見つかりません");
      const order = doc.data();
      requireRestaurant(restaurantId, order.restaurant_id);
      if (order.status !== expectedStatus)
        throw new HttpsError(
          "aborted",
          "別のスタッフが更新しました。最新状態を再確認してください。",
          { reason: "status_changed", currentStatus: order.status }
        );
      if (!(VALID_STATUS_TRANSITIONS[order.status] || []).includes(newStatus))
        throw new HttpsError(
          "failed-precondition",
          "この状態への変更はできません"
        );
      const update = {
        status: newStatus,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: request.auth.uid,
      };
      if (newStatus === ORDER_STATUS.CONFIRMED)
        update.confirmed_at = admin.firestore.FieldValue.serverTimestamp();
      if (newStatus === ORDER_STATUS.COMPLETED)
        update.completed_at = admin.firestore.FieldValue.serverTimestamp();
      transaction.update(orderRef, update);
      return { success: true, status: newStatus };
    });
  }
);
