const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
// The optional per-table token printed in the QR (see utils/tableToken.js).
const validToken = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);
const parseQRCode = (value) => {
  if (typeof value !== "string") return null;
  let restaurantId, tableId, token;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.pathname.replace(/\/$/, "") !== "/order") return null;
      if (
        url.searchParams.getAll("restaurant").length !== 1 ||
        url.searchParams.getAll("table").length !== 1 ||
        url.searchParams.getAll("token").length > 1
      )
        return null;
      restaurantId = url.searchParams.get("restaurant");
      tableId = url.searchParams.get("table");
      token = url.searchParams.get("token") ?? undefined;
    } catch {
      return null;
    }
  } else {
    const parts = value.split("/");
    if (parts.length !== 2 && parts.length !== 3) return null;
    [restaurantId, tableId, token] = parts;
  }
  if (!validId(restaurantId) || !validId(tableId)) return null;
  if (token === undefined) return { restaurantId, tableId };
  return validToken(token) ? { restaurantId, tableId, token } : null;
};

module.exports = { parseQRCode, validId, validToken };
