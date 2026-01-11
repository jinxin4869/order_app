/**
 * グローバルエラーハンドラー
 * アプリ全体で統一的なエラー処理を提供
 */

/**
 * エラーの種類
 */
export const ErrorTypes = {
  NETWORK: "NETWORK",
  FIREBASE: "FIREBASE",
  VALIDATION: "VALIDATION",
  AUTHENTICATION: "AUTHENTICATION",
  PERMISSION: "PERMISSION",
  UNKNOWN: "UNKNOWN",
};

/**
 * エラー情報を構造化
 */
class AppError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, originalError = null) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * エラーをログに記録
 * @param {Error} error - エラーオブジェクト
 * @param {Object} context - エラーが発生したコンテキスト情報
 */
export const logError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    type: error.type || ErrorTypes.UNKNOWN,
    timestamp: error.timestamp || new Date().toISOString(),
    context,
    stack: error.stack,
  };

  // 開発環境ではコンソールに詳細を出力
  if (process.env.NODE_ENV === "development") {
    console.error("🚨 Error Log:", errorInfo);
  }

  // 本番環境では外部エラートラッキングサービス（例：Sentry）に送信
  // TODO: Sentryやその他のエラートラッキングサービスとの統合
  // if (process.env.NODE_ENV === "production") {
  //   Sentry.captureException(error, { extra: errorInfo });
  // }

  return errorInfo;
};

/**
 * Firebaseエラーを解析してユーザーフレンドリーなメッセージに変換
 * @param {Error} error - Firebaseエラー
 * @returns {string} ユーザー向けエラーメッセージ
 */
export const getFirebaseErrorMessage = (error) => {
  const errorCode = error.code || "";

  const errorMessages = {
    // 認証エラー
    "auth/invalid-email": "メールアドレスの形式が正しくありません",
    "auth/user-disabled": "このアカウントは無効化されています",
    "auth/user-not-found": "ユーザーが見つかりません",
    "auth/wrong-password": "パスワードが正しくありません",
    "auth/email-already-in-use": "このメールアドレスは既に使用されています",
    "auth/weak-password": "パスワードは6文字以上にしてください",
    "auth/network-request-failed": "ネットワーク接続を確認してください",

    // Firestore エラー
    "permission-denied": "この操作を実行する権限がありません",
    "not-found": "データが見つかりません",
    "already-exists": "データが既に存在します",
    "resource-exhausted":
      "リクエストの上限に達しました。しばらくお待ちください",
    "failed-precondition": "操作の前提条件が満たされていません",
    aborted: "操作が中断されました",
    "out-of-range": "指定された範囲が無効です",
    unimplemented: "この機能は実装されていません",
    internal: "内部エラーが発生しました",
    unavailable: "サービスが一時的に利用できません",
    "data-loss": "データの損失が発生しました",
    unauthenticated: "認証が必要です",

    // Cloud Functions エラー
    "functions/cancelled": "リクエストがキャンセルされました",
    "functions/deadline-exceeded": "リクエストがタイムアウトしました",
    "functions/invalid-argument": "無効な引数が指定されました",
    "functions/not-found": "関数が見つかりません",
    "functions/permission-denied": "この操作を実行する権限がありません",
    "functions/unauthenticated": "認証が必要です",
    "functions/resource-exhausted": "リソースの上限に達しました",
    "functions/internal": "内部エラーが発生しました",
    "functions/unavailable": "サービスが一時的に利用できません",
  };

  return (
    errorMessages[errorCode] ||
    error.message ||
    "エラーが発生しました。もう一度お試しください"
  );
};

/**
 * ネットワークエラーかどうかを判定
 * @param {Error} error - エラーオブジェクト
 * @returns {boolean}
 */
export const isNetworkError = (error) => {
  return (
    error.message?.includes("network") ||
    error.message?.includes("Network") ||
    error.code === "auth/network-request-failed" ||
    error.code === "unavailable"
  );
};

/**
 * 認証エラーかどうかを判定
 * @param {Error} error - エラーオブジェクト
 * @returns {boolean}
 */
export const isAuthError = (error) => {
  return (
    error.code?.startsWith("auth/") ||
    error.code === "unauthenticated" ||
    error.code === "functions/unauthenticated"
  );
};

/**
 * 権限エラーかどうかを判定
 * @param {Error} error - エラーオブジェクト
 * @returns {boolean}
 */
export const isPermissionError = (error) => {
  return (
    error.code === "permission-denied" ||
    error.code === "functions/permission-denied"
  );
};

/**
 * エラーの種類を判定
 * @param {Error} error - エラーオブジェクト
 * @returns {string} エラータイプ
 */
export const getErrorType = (error) => {
  if (isNetworkError(error)) return ErrorTypes.NETWORK;
  if (isAuthError(error)) return ErrorTypes.AUTHENTICATION;
  if (isPermissionError(error)) return ErrorTypes.PERMISSION;
  if (error.code?.startsWith("functions/") || error.code?.includes("-")) {
    return ErrorTypes.FIREBASE;
  }
  return ErrorTypes.UNKNOWN;
};

/**
 * エラーを処理してユーザー向けメッセージを返す
 * @param {Error} error - エラーオブジェクト
 * @param {Object} context - コンテキスト情報
 * @returns {string} ユーザー向けエラーメッセージ
 */
export const handleError = (error, context = {}) => {
  const errorType = getErrorType(error);
  const appError = new AppError(error.message, errorType, error);

  // エラーをログに記録
  logError(appError, context);

  // Firebaseエラーの場合は専用のメッセージを取得
  if (
    errorType === ErrorTypes.FIREBASE ||
    errorType === ErrorTypes.AUTHENTICATION ||
    errorType === ErrorTypes.PERMISSION
  ) {
    return getFirebaseErrorMessage(error);
  }

  // ネットワークエラーの場合
  if (errorType === ErrorTypes.NETWORK) {
    return "ネットワーク接続を確認してください";
  }

  // その他のエラー
  return error.message || "エラーが発生しました。もう一度お試しください";
};

/**
 * 非同期関数をラップしてエラーハンドリングを追加
 * @param {Function} fn - 非同期関数
 * @param {Object} context - コンテキスト情報
 * @returns {Function} エラーハンドリング付きの関数
 */
export const withErrorHandling = (fn, context = {}) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const userMessage = handleError(error, context);
      throw new AppError(userMessage, getErrorType(error), error);
    }
  };
};

/**
 * リトライ機能付きで関数を実行
 * @param {Function} fn - 実行する関数
 * @param {number} maxRetries - 最大リトライ回数
 * @param {number} delay - リトライ間の遅延（ミリ秒）
 * @returns {Promise} 関数の実行結果
 */
export const withRetry = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 最後の試行でなければリトライ
      if (attempt < maxRetries) {
        // ネットワークエラーの場合のみリトライ
        if (isNetworkError(error)) {
          logError(error, {
            message: `Retry attempt ${attempt}/${maxRetries}`,
          });

          // 指数バックオフで待機
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
          continue;
        }
      }

      // ネットワークエラー以外、または最後の試行の場合はエラーをスロー
      throw error;
    }
  }

  throw lastError;
};

export { AppError };
export default {
  logError,
  handleError,
  getFirebaseErrorMessage,
  isNetworkError,
  isAuthError,
  isPermissionError,
  getErrorType,
  withErrorHandling,
  withRetry,
  ErrorTypes,
  AppError,
};
