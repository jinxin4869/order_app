/* global URL */
import { parseQRCode } from "../../functions/src/utils/qr";
const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const parseOrderLink = parseQRCode;
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
