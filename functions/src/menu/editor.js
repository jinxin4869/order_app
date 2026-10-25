/**
 * メニューの商品情報の編集 - Cloud Functions
 *
 * 編集権限（canEditMenu）を持つスタッフが、商品名・説明・価格・画像URLを
 * 下書きに保存し、確認してから公開する。下書きはお客様から見えない
 * menu_drafts に置く。公開で日本語の原文が変わると、古い翻訳は表示側で
 * 「未確認」として扱われ、翻訳を更新するまで日本語の原文が表示される。
 */

const { onAppCall } = require("../utils/callable");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireMenuEditor, isDocumentId } = require("../utils/staffAuth");
const { isPublished, versionOf } = require("../utils/menuState");

const db = getFirestore();
const FIELDS = ["name_ja", "description_ja", "price", "image_url"];
const refsOf = (restaurantId, itemId) => {
  const store = db.collection("restaurants").doc(restaurantId);
  return {
    item: store.collection("menu_items").doc(itemId),
    draft: store.collection("menu_drafts").doc(itemId),
    events: store.collection("menu_events"),
  };
};
const contentOf = (item) =>
  Object.fromEntries(FIELDS.map((field) => [field, item[field] ?? null]));

// Replays a finished operation; the same ID for another change is refused.
const replay = (event, matches) => {
  if (!event.exists) return null;
  if (!matches(event.data()))
    throw new HttpsError(
      "already-exists",
      "同じ操作IDで別の変更は保存できません"
    );
  return event.data().result;
};

// Only these fields, in these shapes; anything else is refused.
const cleanDraft = (draft) => {
  const fail = (message) => {
    throw new HttpsError("invalid-argument", message);
  };
  if (draft === null || typeof draft !== "object" || Array.isArray(draft))
    fail("下書きの形式が不正です");
  if (Object.keys(draft).some((key) => !FIELDS.includes(key)))
    fail("編集できない項目が含まれています");
  const strip = (value) => value.replace(/<[^>]*>/g, "").trim();
  const name = typeof draft.name_ja === "string" ? strip(draft.name_ja) : "";
  if (!name || name.length > 100) fail("商品名は1〜100文字で入力してください");
  if (draft.description_ja != null && typeof draft.description_ja !== "string")
    fail("説明の形式が不正です");
  const description = strip(draft.description_ja ?? "");
  if (description.length > 500) fail("説明は500文字以下で入力してください");
  if (
    !Number.isSafeInteger(draft.price) ||
    draft.price < 0 ||
    draft.price > 1_000_000
  )
    fail("価格は0〜1,000,000円の整数で入力してください");
  let image = draft.image_url ?? "";
  if (typeof image !== "string") fail("画像URLの形式が不正です");
  image = image.trim();
  if (image) {
    let url;
    try {
      url = new URL(image);
    } catch {
      fail("画像URLの形式が不正です");
    }
    if (url.protocol !== "https:" || image.length > 500)
      fail("画像URLはhttpsで始まる500文字以下のURLにしてください");
  }
  return {
    name_ja: name,
    description_ja: description,
    price: draft.price,
    image_url: image || null,
  };
};
const actor = (request) => ({
  staff_uid: request.auth.uid,
  staff_email: request.auth.token?.email || null,
  created_at: FieldValue.serverTimestamp(),
});
const validVersion = (value) => Number.isSafeInteger(value) && value >= 0;
const loadItem = async (transaction, refs) => {
  const item = await transaction.get(refs.item);
  if (!item.exists || !isPublished(item.data()))
    throw new HttpsError("not-found", "公開中の商品が見つかりません");
  return item.data();
};
const checkVersion = (item, expectedVersion) => {
  const version = versionOf(item.content_version);
  if (version !== expectedVersion)
    throw new HttpsError(
      "aborted",
      "別のスタッフが商品情報を更新しました。最新の内容を確認してください",
      { reason: "version_changed", version }
    );
  return version;
};

exports.getEditableMenuItem = onAppCall({}, async (request) => {
  const restaurantId = await requireMenuEditor(request);
  const { itemId } = request.data || {};
  if (!isDocumentId(itemId))
    throw new HttpsError("invalid-argument", "商品IDが不正です");
  const refs = refsOf(restaurantId, itemId);
  const [item, draft] = await Promise.all([refs.item.get(), refs.draft.get()]);
  if (!item.exists || !isPublished(item.data()))
    throw new HttpsError("not-found", "公開中の商品が見つかりません");
  return {
    item: {
      id: itemId,
      ...contentOf(item.data()),
      allergens: item.data().allergens || [],
      version: versionOf(item.data().content_version),
    },
    draft: draft.exists
      ? {
          ...contentOf(draft.data()),
          base_version: draft.data().base_version,
          staff_email: draft.data().staff_email || null,
        }
      : null,
  };
});

exports.saveMenuItemDraft = onAppCall({}, async (request) => {
  const restaurantId = await requireMenuEditor(request);
  const { itemId, expectedVersion, draft, operationId } = request.data || {};
  if (
    !isDocumentId(itemId) ||
    !validVersion(expectedVersion) ||
    !isDocumentId(operationId)
  )
    throw new HttpsError("invalid-argument", "保存の指定が不正です");
  const content = cleanDraft(draft);
  const refs = refsOf(restaurantId, itemId);
  const eventRef = refs.events.doc(operationId);
  return db.runTransaction(async (transaction) => {
    const done = replay(
      await transaction.get(eventRef),
      (saved) =>
        saved.type === "item_draft" &&
        saved.item_id === itemId &&
        JSON.stringify(saved.to) === JSON.stringify(content)
    );
    if (done) return done;
    const item = await loadItem(transaction, refs);
    const version = checkVersion(item, expectedVersion);
    const result = { success: true, draft: content, base_version: version };
    transaction.set(refs.draft, {
      ...content,
      base_version: version,
      ...actor(request),
    });
    transaction.set(eventRef, {
      type: "item_draft",
      item_id: itemId,
      to: content,
      result,
      ...actor(request),
    });
    return result;
  });
});

exports.discardMenuItemDraft = onAppCall({}, async (request) => {
  const restaurantId = await requireMenuEditor(request);
  const { itemId } = request.data || {};
  if (!isDocumentId(itemId))
    throw new HttpsError("invalid-argument", "商品IDが不正です");
  await refsOf(restaurantId, itemId).draft.delete();
  return { success: true };
});

exports.publishMenuItemDraft = onAppCall({}, async (request) => {
  const restaurantId = await requireMenuEditor(request);
  const { itemId, expectedVersion, operationId } = request.data || {};
  if (
    !isDocumentId(itemId) ||
    !validVersion(expectedVersion) ||
    !isDocumentId(operationId)
  )
    throw new HttpsError("invalid-argument", "公開の指定が不正です");
  const refs = refsOf(restaurantId, itemId);
  const eventRef = refs.events.doc(operationId);
  return db.runTransaction(async (transaction) => {
    const done = replay(
      await transaction.get(eventRef),
      (saved) => saved.type === "item_content" && saved.item_id === itemId
    );
    if (done) return done;
    const draft = await transaction.get(refs.draft);
    const item = await loadItem(transaction, refs);
    if (!draft.exists)
      throw new HttpsError(
        "failed-precondition",
        "公開する下書きがありません",
        {
          reason: "no_draft",
        }
      );
    const version = checkVersion(item, expectedVersion);
    // The draft was written against an older published version.
    if (draft.data().base_version !== version)
      throw new HttpsError(
        "aborted",
        "下書きを作った後に公開中の内容が変わりました。下書きを確認し直してください",
        { reason: "draft_outdated", version }
      );
    const before = contentOf(item);
    const after = contentOf(draft.data());
    const result = {
      success: true,
      version: version + 1,
      // Customers see the Japanese original until translations are updated.
      translationsOutdated:
        before.name_ja !== after.name_ja ||
        before.description_ja !== after.description_ja,
    };
    transaction.update(refs.item, {
      ...after,
      content_version: version + 1,
      content_updated_at: FieldValue.serverTimestamp(),
    });
    transaction.delete(refs.draft);
    transaction.set(eventRef, {
      type: "item_content",
      item_id: itemId,
      from: before,
      to: after,
      result,
      ...actor(request),
    });
    return result;
  });
});
