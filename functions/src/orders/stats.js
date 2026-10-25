/**
 * 日次の集計 - Cloud Functions
 *
 * 所属店舗の1営業日（日本時間0時区切り）の注文数・商品数量・人気商品・
 * 提供までの時間を、その時点のデータから計算する。会計上の売上ではない。
 */

const { onAppCall } = require("../utils/callable");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { requireStaff } = require("../utils/staffAuth");
const { businessDay } = require("../utils/businessDay");

const db = getFirestore();
// One business day per request, read up to this many orders.
const MAX_ORDERS = 2000;
const millis = (value) =>
  value?.toMillis
    ? value.toMillis()
    : value instanceof Date
      ? value.getTime()
      : null;
const validDay = (day) => {
  if (typeof day !== "string" || !/^\d{8}$/.test(day)) return false;
  const date = new Date(
    `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}T00:00:00+09:00`
  );
  return !Number.isNaN(date.getTime()) && businessDay(date) === day;
};
const minutes = (value) => Math.round((value / 60000) * 10) / 10;
// Orders without both times are counted as missing, never estimated.
const durationOf = (orders, from) => {
  const values = [];
  let missing = 0;
  for (const order of orders) {
    const start = millis(order[from]);
    const end = millis(order.served_at);
    if (start === null || end === null || end < start) missing++;
    else values.push(end - start);
  }
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return {
    count: values.length,
    missing,
    medianMinutes: values.length
      ? minutes(
          values.length % 2
            ? values[middle]
            : (values[middle - 1] + values[middle]) / 2
        )
      : null,
    averageMinutes: values.length
      ? minutes(values.reduce((sum, value) => sum + value, 0) / values.length)
      : null,
  };
};

exports.getDailyStats = onAppCall({}, async (request) => {
  const restaurantId = await requireStaff(request);
  const { day = businessDay() } = request.data || {};
  if (!validDay(day))
    throw new HttpsError(
      "invalid-argument",
      "日付はYYYYMMDDで指定してください"
    );
  // Attributed by the business day the order was placed on, even if it was
  // served after midnight.
  const snapshot = await db
    .collection("orders")
    .where("restaurant_id", "==", restaurantId)
    .where("business_day", "==", day)
    .limit(MAX_ORDERS + 1)
    .get();
  const orders = snapshot.docs.slice(0, MAX_ORDERS).map((doc) => doc.data());
  const active = orders.filter((order) => order.status !== "cancelled");
  const items = new Map();
  for (const order of active)
    for (const item of order.items || []) {
      if (!(item.quantity > 0)) continue;
      const entry = items.get(item.item_id) || {
        item_id: item.item_id,
        name_ja: item.name_ja,
        quantity: 0,
        orders: 0,
      };
      entry.quantity += item.quantity;
      entry.orders += 1;
      items.set(item.item_id, entry);
    }
  const served = active.filter((order) =>
    ["served", "completed"].includes(order.status)
  );
  return {
    day,
    generatedAt: Date.now(),
    truncated: snapshot.docs.length > MAX_ORDERS,
    orders: {
      total: orders.length,
      active: active.length,
      cancelled: orders.length - active.length,
      corrected: orders.filter((order) => order.corrected === true).length,
      served: served.length,
    },
    itemQuantity: [...items.values()].reduce(
      (sum, item) => sum + item.quantity,
      0
    ),
    popular: [...items.values()]
      // By quantity, then by how many orders included it.
      .sort(
        (a, b) =>
          b.quantity - a.quantity ||
          b.orders - a.orders ||
          a.item_id.localeCompare(b.item_id)
      )
      .slice(0, 10),
    durations: {
      orderToServed: durationOf(served, "created_at"),
      confirmedToServed: durationOf(served, "confirmed_at"),
    },
  };
});
