/**
 * QRコード対応多言語注文システム - Cloud Functions
 *
 * このファイルは全てのCloud Functionsのエントリーポイントです。
 */

const admin = require("firebase-admin");

// Firebase Admin初期化
admin.initializeApp();

// 各モジュールからエクスポート
const translation = require("./translation");
const orders = require("./orders");
const menu = require("./menu");

// ===== 翻訳関連 =====
exports.translateText = translation.translateText;
exports.batchTranslateMenu = translation.batchTranslateMenu;

// ===== 注文関連 =====
exports.createOrder = orders.createOrder;
exports.updateOrderStatus = orders.updateOrderStatus;

// ===== メニュー関連 =====
exports.getMenuWithTranslation = menu.getMenuWithTranslation;
exports.validateQRCode = menu.validateQRCode;
