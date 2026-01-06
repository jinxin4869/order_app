// Firebase設定ファイル

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

// ⚠️ 重要: Firebase設定が必要です
// .env.exampleを参考に、Firebaseコンソールから取得した実際の値を設定してください
//
// 設定手順:
// 1. https://console.firebase.google.com/ にアクセス
// 2. プロジェクト「qr-order-system-f1acb」を選択
// 3. プロジェクト設定 → マイアプリ → ウェブアプリの設定をコピー
// 4. 以下のコメントアウトを解除して、実際の値を設定
//
// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "qr-order-system-f1acb.firebaseapp.com",
//   projectId: "qr-order-system-f1acb",
//   storageBucket: "qr-order-system-f1acb.firebasestorage.app",
//   messagingSenderId: "YOUR_SENDER_ID",
//   appId: "YOUR_APP_ID",
//   measurementId: "YOUR_MEASUREMENT_ID"
// };

const firebaseConfig = {};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Firestore
export const db = getFirestore(app);

// Cloud Functions（リージョン: asia-northeast1 = 東京）
export const functions = getFunctions(app, "asia-northeast1");

// 開発環境でエミュレータを使用する場合（オプション）
// connectFunctionsEmulator(functions, "localhost", 5001);

export default app;
