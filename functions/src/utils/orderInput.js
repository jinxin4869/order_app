const { HttpsError } = require("firebase-functions/v2/https");
const { isDocumentId } = require("./staffAuth");
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
  const fail = (message) => {
    throw new HttpsError("invalid-argument", message);
  };
  if (!record(data)) fail("注文データはオブジェクトで指定してください。");
  if (!isDocumentId(data.restaurantId) || !isDocumentId(data.tableId))
    fail("店舗・テーブルIDが無効です。");
  if (data.requestId !== undefined && !isDocumentId(data.requestId))
    fail("リクエストIDが無効です。");
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
      item.quantity < 1 ||
      item.quantity > 99
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
  return {
    ...data,
    items,
    customerLanguage: data.customerLanguage ?? "ja",
    customerNotes: sanitizeNotes(data.customerNotes),
  };
};
module.exports = { normalizeOrderInput };
