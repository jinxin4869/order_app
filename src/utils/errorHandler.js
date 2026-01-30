/**
 * グローバルエラーハンドラー
 * アプリ全体で統一的なエラー処理を提供
 */

/* global __DEV__ */

import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

// Sentry初期化フラグ
let sentryInitialized = false;

/**
 * Sentryを初期化する
 * App.jsのルートで呼び出す
 */
export const initializeSentry = () => {
  if (sentryInitialized) return;

  const dsn = Constants.expoConfig?.extra?.sentryDsn;

  if (!dsn) {
    console.warn("Sentry DSN not configured. Error tracking disabled.");
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: __DEV__ ? "development" : "production",
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      // パフォーマンス計測（サンプリングレート）
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      // デバッグモード（開発時のみ）
      debug: __DEV__,
      // エラーのフィルタリング
      beforeSend(event) {
        // 開発環境ではコンソールのみに出力
        if (__DEV__) {
          console.log("Sentry event (dev mode):", event);
          return null; // 開発時はSentryに送信しない
        }
        return event;
      },
    });
    sentryInitialized = true;
    console.log("Sentry initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Sentry:", error);
  }
};

/**
 * Sentryにエラーを送信する
 * @param {Error} error - エラーオブジェクト
 * @param {Object} context - 追加のコンテキスト情報
 */
export const captureError = (error, context = {}) => {
  if (!sentryInitialized) {
    console.error("Sentry not initialized. Error:", error);
    return;
  }

  Sentry.withScope((scope) => {
    // コンテキスト情報を追加
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    // エラータイプをタグとして追加
    if (context.errorType) {
      scope.setTag("error_type", context.errorType);
    }

    // 関数名をタグとして追加
    if (context.function) {
      scope.setTag("function", context.function);
    }

    Sentry.captureException(error);
  });
};

/**
 * ユーザー情報をSentryに設定する
 * @param {Object} user - ユーザー情報
 */
export const setUser = (user) => {
  if (!sentryInitialized) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      tableId: user.tableId,
      restaurantId: user.restaurantId,
      language: user.language,
    });
  } else {
    Sentry.setUser(null);
  }
};

/**
 * カスタムブレッドクラムを追加する
 * @param {string} category - カテゴリ
 * @param {string} message - メッセージ
 * @param {Object} data - 追加データ
 */
export const addBreadcrumb = (category, message, data = {}) => {
  if (!sentryInitialized) return;

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: "info",
  });
};

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
  if (__DEV__) {
    console.error("🚨 Error Log:", errorInfo);
  }

  // Sentryにエラーを送信（本番環境のみ実際に送信）
  captureError(error, {
    ...context,
    errorType: errorInfo.type,
  });

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
    return "ネットワーク接続を確認してください\nPlease check your network connection\n请检查网络连接";
  }

  // その他のエラー
  return (
    error.message ||
    "エラーが発生しました。もう一度お試しください\nAn error occurred. Please try again.\n发生错误，请重试。"
  );
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
  // Sentry関連
  initializeSentry,
  captureError,
  setUser,
  addBreadcrumb,
  // エラーハンドリング
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
