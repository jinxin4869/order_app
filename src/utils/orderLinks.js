/* global URL */
import { parseQRCode, validToken } from "../../functions/src/utils/qr";
const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const parseOrderLink = parseQRCode;
// Keep a validated session URL in the address bar throughout the customer flow.
// Reloading it always re-enters server validation, rather than restoring objects
// serialized by React Navigation as "[object Object]" query parameters.
// The table's QR token, if any, rides along as `token` (entry URL) or inside
// the validated `table` object, so a reload keeps it.
export const getOrderPath = (state) => {
  const route = state.routes?.[state.index ?? 0];
  const params = route?.params || {};
  const token =
    typeof params.token === "string" ? params.token : params.table?.token;
  const session = parseOrderLink(
    `${params.restaurantId || params.restaurant || ""}/${params.tableId || params.table || ""}${token ? `/${token}` : ""}`
  );
  if (!session) return null;
  const path = `/order?restaurant=${session.restaurantId}&table=${session.tableId}`;
  return session.token ? `${path}&token=${session.token}` : path;
};
export const buildOrderLink = (origin, restaurantId, tableId, token) => {
  if (!validId(restaurantId) || !validId(tableId))
    throw new Error("Invalid table identifiers");
  if (token !== undefined && !validToken(token))
    throw new Error("Invalid table token");
  const url = new URL("/order", origin);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("An HTTP(S) origin is required");
  url.searchParams.set("restaurant", restaurantId);
  url.searchParams.set("table", tableId);
  if (token !== undefined) url.searchParams.set("token", token);
  return url.toString();
};
// Why the server refused a table (validateQRCode's "reason"), as
// [Japanese, English, Chinese]. The customer has not chosen a language yet.
const QR_REFUSALS = {
  invalid_format: [
    "QRコードを読み取れませんでした。テーブルのQRコードを読み取り直してください。",
    "This QR code could not be read. Please scan the QR code on your table again.",
    "无法识别此二维码。请重新扫描桌上的二维码。",
  ],
  restaurant_not_found: [
    "この店舗が見つかりません。スタッフにお声がけください。",
    "This restaurant could not be found. Please ask a staff member.",
    "找不到该店铺。请联系店员。",
  ],
  restaurant_inactive: [
    "この店舗は現在、営業していません。スタッフにお声がけください。",
    "This restaurant is not open now. Please ask a staff member.",
    "该店铺目前未营业。请联系店员。",
  ],
  table_not_found: [
    "このテーブルが見つかりません。スタッフにお声がけください。",
    "This table could not be found. Please ask a staff member.",
    "找不到该餐桌。请联系店员。",
  ],
  table_unavailable: [
    "このテーブルは現在利用できません。スタッフにお声がけください。",
    "This table is not available now. Please ask a staff member.",
    "该餐桌目前无法使用。请联系店员。",
  ],
  token_mismatch: [
    "このQRコードは使えません。テーブルのQRコードを読み取り直すか、スタッフにお声がけください。",
    "This QR code cannot be used. Scan the QR code on your table again, or ask a staff member.",
    "此二维码无法使用。请重新扫描桌上的二维码，或联系店员。",
  ],
  check_failed: [
    "テーブルを確認できませんでした。しばらくしてから、もう一度お試しください。",
    "Your table could not be checked. Please try again in a moment.",
    "无法确认餐桌。请稍后重试。",
  ],
};
QR_REFUSALS.qr_mismatch = QR_REFUSALS.token_mismatch;
// An older server sends only Japanese text and no reason.
const QR_REFUSED = [
  "このテーブルは利用できません。スタッフにお声がけください。",
  "This table cannot be used. Please ask a staff member.",
  "该餐桌无法使用。请联系店员。",
];
export const qrRefusal = (reason) => QR_REFUSALS[reason] || QR_REFUSED;
