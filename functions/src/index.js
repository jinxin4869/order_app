/**
 * QRコード対応多言語注文システム - Cloud Functions
 *
 * このファイルは全てのCloud Functionsのエントリーポイントです。
 */

const { initializeApp } = require("firebase-admin/app");

// Firebase Admin初期化
initializeApp();

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
exports.listStaffOrders = orders.listStaffOrders;
exports.getStaffOrder = orders.getStaffOrder;

// ===== メニュー関連 =====
exports.getMenuWithTranslation = menu.getMenuWithTranslation;
exports.validateQRCode = menu.validateQRCode;
