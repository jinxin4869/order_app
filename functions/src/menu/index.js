/**
 * メニュー関連 - Cloud Functions
 *
 * メニュー取得、QRコード検証などを行う
 */

const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * メニューを取得（翻訳付き）
 *
 * @param {Object} data - {restaurantId: string, language: string}
 * @returns {Object} - {categories: Array, items: Array}
 */
exports.getMenuWithTranslation = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const { restaurantId } = request.data;

    // バリデーション
    if (!restaurantId) {
      throw new HttpsError("invalid-argument", "レストランIDが必要です");
    }

    try {
      // レストラン確認
      const restaurantDoc = await db
        .collection("restaurants")
        .doc(restaurantId)
        .get();

      if (!restaurantDoc.exists) {
        console.warn(`Restaurant not found: ${restaurantId}`);
        throw new HttpsError(
          "not-found",
          "指定されたレストランが見つかりません。"
        );
      }

      const restaurant = restaurantDoc.data();

      // 営業中かチェック
      if (!restaurant.is_active) {
        throw new HttpsError(
          "failed-precondition",
          "現在、このレストランは注文の受付を停止しています。"
        );
      }

      // カテゴリ取得（インデックス不足エラーを避けるためメモリ内でソート）
      let categoriesSnapshot;
      try {
        categoriesSnapshot = await db
          .collection("restaurants")
          .doc(restaurantId)
          .collection("menu_categories")
          .where("is_available", "==", true)
          .get();
      } catch (e) {
        console.error("Firestore categories query error:", e);
        throw new HttpsError(
          "internal",
          "カテゴリ情報の取得中にエラーが発生しました。"
        );
      }

      const categories = categoriesSnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name_ja: data.name_ja,
            name_en: data.name_en || data.name_ja,
            name_zh: data.name_zh || data.name_ja,
            description_ja: data.description_ja,
            description_en: data.description_en,
            description_zh: data.description_zh,
            icon: data.icon,
            order: data.order || 0,
          };
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      // メニューアイテム取得（インデックス不足エラーを避けるためメモリ内でソート）
      let itemsSnapshot;
      try {
        itemsSnapshot = await db
          .collection("restaurants")
          .doc(restaurantId)
          .collection("menu_items")
          .where("is_available", "==", true)
          .get();
      } catch (e) {
        console.error("Firestore items query error:", e);
        throw new HttpsError(
          "internal",
          "メニュー項目の取得中にエラーが発生しました。"
        );
      }

      const items = itemsSnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            category_id: data.category_id,
            name_ja: data.name_ja,
            name_en: data.name_en || data.name_ja,
            name_zh: data.name_zh || data.name_ja,
            description_ja: data.description_ja,
            description_en: data.description_en,
            description_zh: data.description_zh,
            price: data.price,
            image_url: data.image_url,
            allergens: data.allergens || [],
            tags: data.tags || [],
            is_available: data.is_available !== false, // デフォルトで提供可能とする
            is_popular: data.is_popular || false,
            spicy_level: data.spicy_level || 0,
            cooking_time: data.cooking_time,
            calories: data.calories,
            order: data.order || 0,
          };
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      return {
        restaurant: {
          id: restaurantDoc.id,
          name: restaurant.name,
          description: restaurant.description,
          default_language: restaurant.default_language,
          supported_languages: restaurant.supported_languages,
        },
        categories,
        items,
      };
    } catch (error) {
      console.error(`Get menu error for ID ${restaurantId}:`, error);

      // すでにHttpsErrorの場合はそのまま投げる
      if (
        error instanceof HttpsError ||
        (error.code && typeof error.code === "string" && error.message)
      ) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "メニューの読み込み中に予期せぬエラーが発生しました。"
      );
    }
  }
);

/**
 * QRコードを検証
 *
 * @param {Object} data - {qrData: string}
 * @returns {Object} - {valid: boolean, restaurant, table, error}
 */
exports.validateQRCode = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const { qrData } = request.data;

    // バリデーション
    if (!qrData || typeof qrData !== "string") {
      return {
        valid: false,
        error: "Invalid QR code format",
      };
    }

    // QRコードデータをパース
    const parts = qrData.split("/");

    if (parts.length !== 2) {
      return {
        valid: false,
        error: "Invalid QR code format: Expected restaurantId/tableId",
      };
    }

    const [restaurantId, tableId] = parts;

    try {
      // レストラン確認
      const restaurantDoc = await db
        .collection("restaurants")
        .doc(restaurantId)
        .get();

      if (!restaurantDoc.exists) {
        console.warn(
          `QR Validation failed: Restaurant ${restaurantId} not found`
        );
        return {
          valid: false,
          error: "指定されたレストランが見つかりません。",
        };
      }

      const restaurant = restaurantDoc.data();

      // 営業中かチェック
      if (!restaurant.is_active) {
        return {
          valid: false,
          error: "現在、このレストランは営業しておりません。",
        };
      }

      // テーブル確認
      const tableDoc = await db
        .collection("restaurants")
        .doc(restaurantId)
        .collection("tables")
        .doc(tableId)
        .get();

      if (!tableDoc.exists) {
        console.warn(
          `QR Validation failed: Table ${tableId} not found in ${restaurantId}`
        );
        return {
          valid: false,
          error: "指定されたテーブルが見つかりません。",
        };
      }

      const table = tableDoc.data();

      // QRコードの一致確認（セキュリティ強化のため）
      const expectedQRCode = `${restaurantId}/${tableId}`;
      if (
        table.qr_code &&
        table.qr_code !== expectedQRCode &&
        table.qr_code !== qrData
      ) {
        console.warn(
          `QR Validation failed: QR code mismatch for table ${tableId}`
        );
        return {
          valid: false,
          error: "無効なQRコードです（データの不一致）。",
        };
      }

      // 成功
      return {
        valid: true,
        restaurant: {
          id: restaurantDoc.id,
          name: restaurant.name,
          description: restaurant.description,
          default_language: restaurant.default_language,
          supported_languages: restaurant.supported_languages || ["ja"],
        },
        table: {
          id: tableDoc.id,
          table_number: table.table_number,
          capacity: table.capacity,
          status: table.status,
          floor: table.floor,
          notes: table.notes,
        },
      };
    } catch (error) {
      console.error(`QR validation error for ${qrData}:`, error);

      return {
        valid: false,
        error:
          "QRコードの検証中に通信エラーが発生しました。時間を置いて再度お試しください。",
      };
    }
  }
);

/**
 * 特定メニューアイテムの詳細を取得
 *
 * @param {Object} data - {restaurantId: string, itemId: string}
 * @returns {Object} - メニューアイテムの詳細
 */
exports.getMenuItem = onCall({ region: "asia-northeast1" }, async (request) => {
  const { restaurantId, itemId } = request.data;

  // バリデーション
  if (!restaurantId || !itemId) {
    throw new HttpsError(
      "invalid-argument",
      "Restaurant ID and Item ID are required"
    );
  }

  try {
    const itemDoc = await db
      .collection("restaurants")
      .doc(restaurantId)
      .collection("menu_items")
      .doc(itemId)
      .get();

    if (!itemDoc.exists) {
      console.warn(
        `Menu item not found: ${itemId} in restaurant ${restaurantId}`
      );
      throw new HttpsError(
        "not-found",
        "指定されたメニューアイテムが見つかりません。"
      );
    }

    const itemData = itemDoc.data();

    // 提供可能かチェック
    if (!itemData.is_available) {
      throw new HttpsError(
        "failed-precondition",
        "この商品は現在品切れ中または提供を停止しています。"
      );
    }

    return {
      id: itemDoc.id,
      ...itemData,
    };
  } catch (error) {
    console.error(`Get menu item error (ID: ${itemId}):`, error);

    if (
      error instanceof HttpsError ||
      (error.code && typeof error.code === "string" && error.message)
    ) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "メニューアイテムの取得中にエラーが発生しました。"
    );
  }
});
