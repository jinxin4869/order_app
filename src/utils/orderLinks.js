/* global URL */
import { parseQRCode } from "../../functions/src/utils/qr";
const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const parseOrderLink = parseQRCode;
// Keep a validated session URL in the address bar throughout the customer flow.
// Reloading it always re-enters server validation, rather than restoring objects
// serialized by React Navigation as "[object Object]" query parameters.
export const getOrderPath = (state) => {
  const route = state.routes?.[state.index ?? 0];
  const params = route?.params || {};
  const session = parseOrderLink(
    `${params.restaurantId || params.restaurant || ""}/${params.tableId || params.table || ""}`
  );
  return session
    ? `/order?restaurant=${session.restaurantId}&table=${session.tableId}`
    : null;
};
export const buildOrderLink = (origin, restaurantId, tableId) => {
  if (!validId(restaurantId) || !validId(tableId))
    throw new Error("Invalid table identifiers");
  const url = new URL("/order", origin);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("An HTTP(S) origin is required");
  url.searchParams.set("restaurant", restaurantId);
  url.searchParams.set("table", tableId);
  return url.toString();
};
