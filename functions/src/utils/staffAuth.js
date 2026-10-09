const { HttpsError } = require("firebase-functions/v2/https");
const isDocumentId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

// Claims must be assigned by a trusted administrator, never by client input.
const requireStaff = (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "スタッフとしてログインしてください。");
  }
  const claims = request.auth.token || {};
  if (claims.role !== "staff" || !isDocumentId(claims.restaurantId)) {
    throw new HttpsError("permission-denied", "店舗スタッフの権限が必要です。");
  }
  return claims.restaurantId;
};
const requireRestaurant = (staffRestaurantId, restaurantId) => {
  if (staffRestaurantId !== restaurantId) {
    throw new HttpsError("permission-denied", "所属店舗以外の操作はできません。");
  }
};
module.exports = { requireStaff, requireRestaurant, isDocumentId };
