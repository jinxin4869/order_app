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
