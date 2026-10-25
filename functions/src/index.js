/**
 * QRコード対応多言語注文システム - Cloud Functions
 *
 * このファイルは全てのCloud Functionsのエントリーポイントです。
 */

const { initializeApp } = require("firebase-admin/app");
const { setGlobalOptions } = require("firebase-functions/v2");

// Firebase Admin初期化
initializeApp();

// 不正な大量リクエストでの課金・DeepL消費を抑えるため、全関数の同時インスタンス数に上限を設ける。
// 各モジュールのonCallより前に設定する必要がある。
setGlobalOptions({ maxInstances: 10 });

// 各モジュールからエクスポート
const translation = require("./translation");
const orders = require("./orders");
const menu = require("./menu");

// ===== 翻訳関連 =====
exports.translateText = translation.translateText;
exports.batchTranslateMenu = translation.batchTranslateMenu;

// ===== 注文関連 =====
exports.createOrder = orders.createOrder;
exports.getOrderRequest = orders.getOrderRequest;
exports.listVisitOrders = orders.listVisitOrders;
exports.closeTableVisit = orders.closeTableVisit;
exports.updateOrderStatus = orders.updateOrderStatus;
exports.listStaffOrders = orders.listStaffOrders;
exports.getStaffOrder = orders.getStaffOrder;

// ===== メニュー関連 =====
exports.getMenuWithTranslation = menu.getMenuWithTranslation;
exports.validateQRCode = menu.validateQRCode;
exports.getMenuAvailability = menu.getMenuAvailability;

const staffMenu = require("./menu/staff");
exports.getStaffMenu = staffMenu.getStaffMenu;
exports.setMenuItemAvailability = staffMenu.setMenuItemAvailability;
exports.setOrderingAvailability = staffMenu.setOrderingAvailability;
