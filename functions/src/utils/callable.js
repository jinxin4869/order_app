const { onCall, HttpsError } = require("firebase-functions/v2/https");

// Off until the web app has a registered App Check provider; enabling it
// earlier would reject every customer. Set ENFORCE_APP_CHECK=true in
// functions/.env once reCAPTCHA Enterprise is configured.
const appCheckEnforced = () => process.env.ENFORCE_APP_CHECK === "true";

// Every callable shares the region and App Check gate. Invalid tokens are
// already rejected by the Callable middleware; this rejects missing ones.
const onAppCall = (options, handler) =>
  onCall({ region: "asia-northeast1", ...options }, async (request) => {
    if (appCheckEnforced() && !request.app) {
      throw new HttpsError(
        "failed-precondition",
        "アプリの検証に失敗しました。ページを再読み込みしてください。",
        { reason: "app_check_required" }
      );
    }
    return handler(request);
  });

module.exports = { onAppCall };
