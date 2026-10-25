const { HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const isDocumentId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

// Callable middleware verifies the token signature. Always fetch current Auth
// state as well: an otherwise valid token can outlive a role change or a stop.
// Returns the store and the user's current custom claims.
const verifyStaff = async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "スタッフとしてログインしてください。"
    );
  }
  const claims = request.auth.token || {};
  if (claims.role !== "staff" || !isDocumentId(claims.restaurantId)) {
    throw new HttpsError("permission-denied", "店舗スタッフの権限が必要です。");
  }
  if (
    !Number.isSafeInteger(claims.auth_time) ||
    claims.auth_time <= 0 ||
    !Number.isSafeInteger(claims.auth_time * 1000)
  ) {
    throw new HttpsError("unauthenticated", "再ログインしてください。");
  }
  let user;
  try {
    // Do not cache authorization: later requests must see stops and transfers.
    user = await getAuth().getUser(request.auth.uid);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new HttpsError("unauthenticated", "再ログインしてください。");
    }
    throw new HttpsError(
      "unavailable",
      "スタッフ権限を確認できません。時間を置いて再度お試しください。"
    );
  }
  if (user.disabled === true) {
    throw new HttpsError("unauthenticated", "再ログインしてください。");
  }
  const validAfter = Date.parse(user.tokensValidAfterTime);
  if (
    user.uid !== request.auth.uid ||
    user.disabled !== false ||
    !Number.isFinite(validAfter)
  ) {
    throw new HttpsError("unavailable", "スタッフ権限を確認できません。");
  }
  // Auth timestamps have second precision. Reject the boundary second too so
  // revoking immediately after login cannot leave that token usable.
  if (claims.auth_time * 1000 <= validAfter) {
    throw new HttpsError("unauthenticated", "再ログインしてください。");
  }
  const current = user.customClaims || {};
  if (
    current.role !== "staff" ||
    current.restaurantId !== claims.restaurantId
  ) {
    throw new HttpsError(
      "permission-denied",
      "スタッフ権限が変更されています。再ログインしてください。"
    );
  }
  return { restaurantId: claims.restaurantId, claims: current };
};
const requireStaff = async (request) =>
  (await verifyStaff(request)).restaurantId;
// Editing menu content is granted per staff member (canEditMenu: true),
// checked against the current claims like every other permission.
const requireMenuEditor = async (request) => {
  const { restaurantId, claims } = await verifyStaff(request);
  if (claims.canEditMenu !== true)
    throw new HttpsError(
      "permission-denied",
      "メニューを編集する権限がありません。"
    );
  return restaurantId;
};
const requireRestaurant = (staffRestaurantId, restaurantId) => {
  if (staffRestaurantId !== restaurantId) {
    throw new HttpsError(
      "permission-denied",
      "所属店舗以外の操作はできません。"
    );
  }
};
module.exports = {
  requireStaff,
  requireMenuEditor,
  requireRestaurant,
  isDocumentId,
};
