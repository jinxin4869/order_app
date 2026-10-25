// 新規注文の連投制限。テーブルごと・店舗全体を、固定の時間枠で数える。
// 判定とカウントは注文と同じトランザクションで行う。
// ENFORCE_ORDER_LIMITS=true のときだけ拒否し、それ以外は超過を記録するだけ。
const { HttpsError } = require("firebase-functions/v2/https");

const limitsEnforced = () => process.env.ENFORCE_ORDER_LIMITS === "true";
const positive = (value, fallback) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};
// Defaults: a seated group rarely sends more than a few orders in 10 minutes,
// and a store rarely takes more than one a second. See docs/order_limits.md.
const windows = () => [
  {
    scope: "table",
    windowMs: 10 * 60 * 1000,
    max: positive(process.env.ORDER_LIMIT_PER_TABLE, 10),
  },
  {
    scope: "store",
    windowMs: 60 * 1000,
    max: positive(process.env.ORDER_LIMIT_PER_STORE, 60),
  },
];

// One counter document per table and one per store, overwritten when the
// window moves on, so the collection does not grow with traffic.
const counterRef = (restaurantRef, scope, tableId) =>
  restaurantRef
    .collection("rate_limits")
    .doc(scope === "table" ? `table_${tableId}` : "store");

// Read inside the order transaction, before any write.
const readOrderLimits = async (transaction, restaurantRef, tableId, now) => {
  const limits = windows();
  const docs = await transaction.getAll(
    ...limits.map((limit) => counterRef(restaurantRef, limit.scope, tableId))
  );
  return limits.map((limit, index) => {
    const start = now - (now % limit.windowMs);
    const saved = docs[index].exists ? docs[index].data() : null;
    const count = saved?.window_start === start ? saved.count : 0;
    return {
      ...limit,
      ref: docs[index].ref,
      start,
      count,
      exceeded: count >= limit.max,
      retryAfterSeconds: Math.ceil((start + limit.windowMs - now) / 1000),
    };
  });
};

const rateLimitedError = (hit) =>
  new HttpsError(
    "resource-exhausted",
    "短時間に多くの注文が送信されたため、受付を一時的に制限しています。",
    {
      reason: "rate_limited",
      scope: hit.scope,
      retryAfterSeconds: hit.retryAfterSeconds,
    }
  );

module.exports = { limitsEnforced, readOrderLimits, rateLimitedError };
