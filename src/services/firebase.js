// Firebase設定ファイル

// Import the functions you need from the SDKs you need
import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getFunctions } from "firebase/functions";

// .envファイルから環境変数を読み込み
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
  FIREBASE_FUNCTIONS_REGION,
  FIREBASE_APPCHECK_SITE_KEY,
} from "@env";

// Firebase configuration
const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  measurementId: FIREBASE_MEASUREMENT_ID,
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// App Check（Web のみ）。サイトキー未設定の環境（ローカル・エミュレーター）では無効のまま。
// Functions 側で ENFORCE_APP_CHECK=true にする前に、本番ビルドへキーを設定すること。
if (Platform.OS === "web" && FIREBASE_APPCHECK_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(FIREBASE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Cloud Functions（リージョンは環境変数から取得、デフォルト: asia-northeast1）
export const functions = getFunctions(
  app,
  FIREBASE_FUNCTIONS_REGION || "asia-northeast1"
);

export default app;
