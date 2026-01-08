// Firebase設定ファイル

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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

// Firestore
export const db = getFirestore(app);

// Cloud Functions（リージョンは環境変数から取得、デフォルト: asia-northeast1）
export const functions = getFunctions(
  app,
  FIREBASE_FUNCTIONS_REGION || "asia-northeast1"
);

// 開発環境でエミュレータを使用する場合（オプション）
// connectFunctionsEmulator(functions, "localhost", 5001);

export default app;
