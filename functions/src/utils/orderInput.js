const { HttpsError } = require("firebase-functions/v2/https");
const { isDocumentId } = require("./staffAuth");
const {
  MIN_ORDER_QUANTITY,
  MAX_ORDER_QUANTITY,
  MAX_ORDER_TOTAL_QUANTITY,
} = require("./orderLimits");
const { validToken } = require("./qr");
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const money = (value) =>
  Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;
const optionalText = (value, max) =>
  value == null || (typeof value === "string" && value.length <= max);
const sanitizeNotes = (value) =>
  value == null ? null : value.replace(/<[^>]*>/g, "").trim() || null;

// Validate before iterating or touching Firestore; never mutate caller input.
const normalizeOrderInput = (data) => {
  const fail = (message, details) => {
    throw new HttpsError("invalid-argument", message, details);
  };
  if (!record(data)) fail("注文データはオブジェクトで指定してください。");
  if (!isDocumentId(data.restaurantId) || !isDocumentId(data.tableId))
    fail("店舗・テーブルIDが無効です。");
  if (!isDocumentId(data.requestId)) fail("リクエストIDが無効です。");
  if (data.visitId != null && !isDocumentId(data.visitId))
    fail("来店IDが無効です。");
  if (data.tableToken != null && !validToken(data.tableToken))
    fail("テーブルのQRコードが無効です。");
  if (
    !Array.isArray(data.items) ||
    !data.items.length ||
    data.items.length > 100
  )
    fail("商品は1〜100行の配列で指定してください。");
  if (!["ja", "en", "zh"].includes(data.customerLanguage ?? "ja"))
    fail("言語が無効です。");
  if (![data.subtotal, data.tax, data.totalAmount].every(money))
    fail("金額は有限の非負整数で指定してください。");
  if (!optionalText(data.customerNotes, 200))
    fail("注文備考は200文字以下で指定してください。");
  const items = data.items.map((item) => {
    if (!record(item) || !isDocumentId(item.item_id))
      fail("商品IDが無効です。");
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < MIN_ORDER_QUANTITY ||
      item.quantity > MAX_ORDER_QUANTITY
    )
      fail("数量は1〜99の整数で指定してください。");
    if (!money(item.price)) fail("単価は有限の非負整数で指定してください。");
    if (!optionalText(item.notes, 200))
      fail("商品備考は200文字以下で指定してください。");
    if (item.special_request !== undefined)
      fail("商品備考はnotesで指定してください。");
    for (const key of ["name", "name_ja", "name_en", "name_zh"]) {
      if (!optionalText(item[key], 200)) fail("商品名の形式が無効です。");
    }
    return {
      item_id: item.item_id,
      quantity: item.quantity,
      price: item.price,
      notes: sanitizeNotes(item.notes),
    };
  });
  // The cart keeps one line per item and notes, so a repeat is never a real
  // cart; it would only split a line to get past the per-line limit.
  const lines = new Set();
  for (const item of items) {
    const line = JSON.stringify([item.item_id, item.notes]);
    if (lines.has(line))
      fail("同じ商品・備考の行が重複しています。", {
        reason: "duplicate_line",
        itemId: item.item_id,
      });
    lines.add(line);
  }
  if (
    items.reduce((sum, item) => sum + item.quantity, 0) >
    MAX_ORDER_TOTAL_QUANTITY
  )
    fail(`1回の注文の数量は合計${MAX_ORDER_TOTAL_QUANTITY}個までです。`, {
      reason: "too_many_items",
      max: MAX_ORDER_TOTAL_QUANTITY,
    });
  return {
    ...data,
    items,
    customerLanguage: data.customerLanguage ?? "ja",
    visitId: data.visitId ?? null,
    tableToken: data.tableToken ?? null,
    customerNotes: sanitizeNotes(data.customerNotes),
  };
};
module.exports = { normalizeOrderInput, optionalText, sanitizeNotes };
