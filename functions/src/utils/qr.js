const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const parseQRCode = (value) => {
  if (typeof value !== "string") return null;
  let restaurantId, tableId;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.pathname.replace(/\/$/, "") !== "/order") return null;
      if (
        url.searchParams.getAll("restaurant").length !== 1 ||
        url.searchParams.getAll("table").length !== 1
      )
        return null;
      restaurantId = url.searchParams.get("restaurant");
      tableId = url.searchParams.get("table");
    } catch {
      return null;
    }
  } else {
    const parts = value.split("/");
    if (parts.length !== 2) return null;
    [restaurantId, tableId] = parts;
  }
  return validId(restaurantId) && validId(tableId)
    ? { restaurantId, tableId }
    : null;
};

module.exports = { parseQRCode };
