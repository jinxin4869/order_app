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
