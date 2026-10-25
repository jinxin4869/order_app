/**
 * スタッフ向けメニュー管理 - Cloud Functions
 *
 * 所属店舗の商品の売り切れ・販売再開と、店舗の新規注文受付の停止・再開を行う。
 * 変更は版番号で競合を検出し、操作IDで重複を防ぎ、操作記録と同じ
 * トランザクションで保存する。
 */

const { onAppCall } = require("../utils/callable");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireStaff, isDocumentId } = require("../utils/staffAuth");
const { isPublished, orderingState, versionOf } = require("../utils/menuState");

const db = getFirestore();
const storeOf = (restaurantId) =>
  db.collection("restaurants").doc(restaurantId);

const validVersion = (value) => Number.isSafeInteger(value) && value >= 0;

// Shared by both setters: replay a finished operation, or reject an ID reused
// for a different change.
const replay = (event, matches) => {
  if (!event.exists) return null;
  if (!matches(event.data()))
    throw new HttpsError(
      "already-exists",
      "同じ操作IDで別の変更は保存できません"
    );
  return event.data().result;
};
const actor = (request) => ({
  staff_uid: request.auth.uid,
  staff_email: request.auth.token?.email || null,
  created_at: FieldValue.serverTimestamp(),
});

exports.getStaffMenu = onAppCall({}, async (request) => {
  const restaurantId = await requireStaff(request);
  const store = storeOf(restaurantId);
  const [restaurant, categories, items] = await Promise.all([
    store.get(),
    store.collection("menu_categories").get(),
    store.collection("menu_items").get(),
  ]);
  if (!restaurant.exists)
    throw new HttpsError("not-found", "店舗が見つかりません");
  const visibleCategories = categories.docs.filter(
    (doc) => doc.data().is_available === true
  );
  const categoryIds = new Set(visibleCategories.map((doc) => doc.id));
  const settings = restaurant.data();
  return {
    restaurant: {
      name: settings.name || "",
      ordering: orderingState(settings),
      version: versionOf(settings.ordering_version),
    },
    categories: visibleCategories
      .map((doc) => ({
        id: doc.id,
        name_ja: doc.data().name_ja || "",
        order: doc.data().order || 0,
      }))
      .sort((a, b) => a.order - b.order),
    // Only what customers can see; private items are not managed here.
    items: items.docs
      .filter(
        (doc) =>
          isPublished(doc.data()) &&
          (!doc.data().category_id || categoryIds.has(doc.data().category_id))
      )
      .map((doc) => {
        const item = doc.data();
        return {
          id: doc.id,
          category_id: item.category_id || null,
          name_ja: item.name_ja || "",
          price: item.price,
          available: item.is_available === true,
          version: versionOf(item.availability_version),
          order: item.order || 0,
        };
      })
      .sort((a, b) => a.order - b.order),
  };
});

exports.setMenuItemAvailability = onAppCall({}, async (request) => {
  const restaurantId = await requireStaff(request);
  const { itemId, available, expectedVersion, operationId } =
    request.data || {};
  if (
    !isDocumentId(itemId) ||
    typeof available !== "boolean" ||
    !validVersion(expectedVersion) ||
    !isDocumentId(operationId)
  )
    throw new HttpsError("invalid-argument", "変更の指定が不正です");
  const store = storeOf(restaurantId);
  const itemRef = store.collection("menu_items").doc(itemId);
  const eventRef = store.collection("menu_events").doc(operationId);
  return db.runTransaction(async (transaction) => {
    const event = await transaction.get(eventRef);
    const done = replay(
      event,
      (saved) =>
        saved.type === "item_availability" &&
        saved.item_id === itemId &&
        saved.to === available
    );
    if (done) return done;
    const item = await transaction.get(itemRef);
    if (!item.exists || !isPublished(item.data()))
      throw new HttpsError("not-found", "公開中の商品が見つかりません");
    const current = item.data();
    const version = versionOf(current.availability_version);
    if (version !== expectedVersion)
      throw new HttpsError(
        "aborted",
        "別のスタッフが変更しました。最新の状態を確認してください",
        {
          reason: "version_changed",
          available: current.is_available === true,
          version,
        }
      );
    const result = { success: true, available, version: version + 1 };
    // Marking a legacy item sold out also fixes it as published, so it stays
    // on the menu instead of disappearing.
    transaction.update(itemRef, {
      is_available: available,
      is_published: true,
      availability_version: version + 1,
      availability_updated_at: FieldValue.serverTimestamp(),
    });
    transaction.set(eventRef, {
      type: "item_availability",
      item_id: itemId,
      from: current.is_available === true,
      to: available,
      result,
      ...actor(request),
    });
    return result;
  });
});

exports.setOrderingAvailability = onAppCall({}, async (request) => {
  const restaurantId = await requireStaff(request);
  const { enabled, expectedVersion, operationId } = request.data || {};
  if (
    typeof enabled !== "boolean" ||
    !validVersion(expectedVersion) ||
    !isDocumentId(operationId)
  )
    throw new HttpsError("invalid-argument", "変更の指定が不正です");
  const store = storeOf(restaurantId);
  const eventRef = store.collection("menu_events").doc(operationId);
  return db.runTransaction(async (transaction) => {
    const event = await transaction.get(eventRef);
    const done = replay(
      event,
      (saved) => saved.type === "ordering" && saved.to === enabled
    );
    if (done) return done;
    const restaurant = await transaction.get(store);
    if (!restaurant.exists)
      throw new HttpsError("not-found", "店舗が見つかりません");
    const current = restaurant.data();
    const version = versionOf(current.ordering_version);
    if (version !== expectedVersion)
      throw new HttpsError(
        "aborted",
        "別のスタッフが変更しました。最新の状態を確認してください",
        {
          reason: "version_changed",
          ordering: orderingState(current),
          version,
        }
      );
    const result = {
      success: true,
      ordering: enabled ? "open" : "paused",
      version: version + 1,
    };
    // is_active (the store's own on/off) is left alone.
    transaction.update(store, {
      ordering_enabled: enabled,
      ordering_version: version + 1,
      ordering_updated_at: FieldValue.serverTimestamp(),
    });
    transaction.set(eventRef, {
      type: "ordering",
      from: orderingState(current),
      to: enabled,
      result,
      ...actor(request),
    });
    return result;
  });
});
