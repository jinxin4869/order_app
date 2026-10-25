/**
 * メニュー関連 - Cloud Functions
 *
 * メニュー取得、QRコード検証などを行う
 */

const { onAppCall } = require("../utils/callable");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { parseQRCode, validId } = require("../utils/qr");
const { isPublished, orderingState } = require("../utils/menuState");
const {
  tokenEnforced,
  tableSecretRef,
  matchesTableToken,
} = require("../utils/tableToken");

const db = getFirestore();
const translationMetadata = (data) => {
  const metadata = {};
  for (const field of ["name", "description"])
    for (const lang of ["en", "zh"])
      for (const suffix of ["", "_nodic"]) {
        const key = `${field}_${lang}${suffix}_translation`;
        if (data[key]) metadata[key] = data[key];
      }
  return metadata;
};

/**
 * メニューを取得（翻訳付き）
 *
 * @param {Object} data - {restaurantId: string, language: string}
 * @returns {Object} - {categories: Array, items: Array}
 */
exports.getMenuWithTranslation = onAppCall({}, async (request) => {
  const { restaurantId } = request.data || {};

  // バリデーション
  if (!validId(restaurantId)) {
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
          ...translationMetadata(data),
          name_ja: data.name_ja,
          name_en: data.name_en || "",
          name_zh: data.name_zh || "",
          name_en_nodic: data.name_en_nodic || "",
          name_zh_nodic: data.name_zh_nodic || "",
          description_ja: data.description_ja,
          description_en: data.description_en,
          description_zh: data.description_zh,
          description_en_nodic: data.description_en_nodic || "",
          description_zh_nodic: data.description_zh_nodic || "",
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
        .get();
    } catch (e) {
      console.error("Firestore items query error:", e);
      throw new HttpsError(
        "internal",
        "メニュー項目の取得中にエラーが発生しました。"
      );
    }

    // Published items, on sale or sold out, in a published category.
    const categoryIds = new Set(categories.map((category) => category.id));
    const items = itemsSnapshot.docs
      .filter(
        (doc) =>
          isPublished(doc.data()) &&
          (!doc.data().category_id || categoryIds.has(doc.data().category_id))
      )
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          category_id: data.category_id,
          ...translationMetadata(data),
          name_ja: data.name_ja,
          name_en: data.name_en || "",
          name_zh: data.name_zh || "",
          name_en_nodic: data.name_en_nodic || "",
          name_zh_nodic: data.name_zh_nodic || "",
          description_ja: data.description_ja,
          description_en: data.description_en,
          description_zh: data.description_zh,
          description_en_nodic: data.description_en_nodic || "",
          description_zh_nodic: data.description_zh_nodic || "",
          price: data.price,
          image_url: data.image_url,
          allergens: data.allergens || [],
          tags: data.tags || [],
          is_available: data.is_available === true,
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
        ordering: orderingState(restaurant),
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
});

/**
 * 表示中のメニューの販売・受付状態だけを返す（15秒ごとの確認用）。
 * 店舗の文書と販売不可の商品だけを読み、説明や翻訳は読み直さない。
 */
exports.getMenuAvailability = onAppCall({}, async (request) => {
  const { restaurantId } = request.data || {};
  if (!validId(restaurantId))
    throw new HttpsError("invalid-argument", "レストランIDが必要です");
  const store = db.collection("restaurants").doc(restaurantId);
  const [restaurant, unavailable] = await Promise.all([
    store.get(),
    store.collection("menu_items").where("is_available", "==", false).get(),
  ]);
  if (!restaurant.exists || restaurant.data().is_active !== true)
    throw new HttpsError("not-found", "指定されたレストランが見つかりません。");
  return {
    ordering: orderingState(restaurant.data()),
    soldOut: unavailable.docs
      .filter((doc) => isPublished(doc.data()))
      .map((doc) => doc.id),
  };
});

/**
 * QRコードを検証
 *
 * @param {Object} data - {qrData: string}
 * @returns {Object} - {valid: boolean, restaurant, table, error}
 */
exports.validateQRCode = onAppCall({}, async (request) => {
  const { qrData } = request.data || {};

  // バリデーション
  if (!qrData || typeof qrData !== "string") {
    return {
      valid: false,
      error: "Invalid QR code format",
    };
  }

  const session = parseQRCode(qrData);
  if (!session)
    return {
      valid: false,
      error:
        "Invalid QR code format: Expected restaurantId/tableId or an order URL",
    };
  const { restaurantId, tableId } = session;

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

    if (table.is_active === false || table.status === "unavailable") {
      return { valid: false, error: "このテーブルは現在利用できません。" };
    }

    if (
      tokenEnforced() &&
      !matchesTableToken(
        await tableSecretRef(db, restaurantId, tableId).get(),
        session.token
      )
    )
      return {
        valid: false,
        error:
          "このQRコードは使えません。テーブルのQRコードを読み取り直すか、スタッフへお声がけください。",
      };

    const storedSession = table.qr_code ? parseQRCode(table.qr_code) : null;
    if (
      table.qr_code &&
      (!storedSession ||
        storedSession.restaurantId !== restaurantId ||
        storedSession.tableId !== tableId)
    ) {
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
    console.error(`QR validation error for ${restaurantId}/${tableId}:`, error);

    return {
      valid: false,
      error:
        "QRコードの検証中に通信エラーが発生しました。時間を置いて再度お試しください。",
    };
  }
});
