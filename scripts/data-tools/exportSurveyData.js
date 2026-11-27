/**
 * アンケート用翻訳データ取得スクリプト
 *
 * Firestoreのmenu_itemsから、アンケート対象メニュー項目の
 * 辞書あり翻訳と辞書なし(_nodic)翻訳を取得してJSONファイルに出力する。
 *
 * 使用方法:
 *   cd scripts/data-tools && node exportSurveyData.js
 *
 * 出力:
 *   survey/survey_translation_data.json
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccount = require("./credentials.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// アンケート対象メニュー項目の日本語名（Part A: 料理名翻訳 10問）
const SURVEY_ITEMS_PART_A = [
  "中トロ刺身",
  "しめ鯖",
  "イクラ軍艦（2貫）",
  "穴子握り（2貫）",
  "ホッケの開き",
  "ブリの照り焼き",
  "揚げ出し豆腐",
  "筑前煮",
  "親子丼",
  "大学芋",
];

// Part B: 説明文翻訳 5問
const SURVEY_ITEMS_PART_B = [
  "揚げ出し豆腐",
  "茶碗蒸し",
  "肉じゃが",
  "チキン南蛮",
  "親子丼",
];

// Part C: アレルゲン表示 5問
const SURVEY_ITEMS_PART_C = [
  "揚げ出し豆腐",
  "茶碗蒸し",
  "天ぷら盛り合わせ",
  "エビフライ（3尾）",
  "カルボナーラ",
];

// 全対象項目（重複除外）
const ALL_TARGET_ITEMS = [
  ...new Set([
    ...SURVEY_ITEMS_PART_A,
    ...SURVEY_ITEMS_PART_B,
    ...SURVEY_ITEMS_PART_C,
  ]),
];

async function exportSurveyData() {
  console.log("アンケート用翻訳データを取得中...\n");

  // 全レストランからmenu_itemsを取得（項目が複数レストランに分散しているため）
  const restaurantIds = ["rest001", "rest003", "rest004"];
  const results = {};
  let matchCount = 0;

  for (const restaurantId of restaurantIds) {
    const snapshot = await db
      .collection("restaurants")
      .doc(restaurantId)
      .collection("menu_items")
      .get();

    console.log(`${restaurantId}: ${snapshot.size}件取得`);

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const nameJa = data.name_ja;

      if (ALL_TARGET_ITEMS.includes(nameJa) && !results[nameJa]) {
        matchCount++;
        results[nameJa] = {
          id: doc.id,
          restaurantId,
          name_ja: nameJa,
          // 辞書あり翻訳
          name_en: data.name_en || null,
          name_zh: data.name_zh || null,
          description_en: data.description_en || null,
          description_zh: data.description_zh || null,
          // 辞書なし翻訳 (_nodic)
          name_en_nodic: data.name_en_nodic || null,
          name_zh_nodic: data.name_zh_nodic || null,
          description_en_nodic: data.description_en_nodic || null,
          description_zh_nodic: data.description_zh_nodic || null,
          // アレルゲン情報
          allergens: data.allergens || [],
          // カテゴリ
          category_id: data.category_id || null,
        };
      }
    });
  }

  console.log(
    `対象メニュー項目: ${ALL_TARGET_ITEMS.length}件中 ${matchCount}件マッチ\n`
  );

  // マッチしなかった項目を表示
  const matchedNames = Object.keys(results);
  const missing = ALL_TARGET_ITEMS.filter(
    (name) => !matchedNames.includes(name)
  );
  if (missing.length > 0) {
    console.log("⚠️  マッチしなかった項目:");
    missing.forEach((name) => console.log(`  - ${name}`));
    console.log("");
  }

  // _nodicフィールドの有無を確認
  console.log("--- 翻訳データ確認 ---");
  Object.values(results).forEach((item) => {
    const hasNodic = item.name_en_nodic || item.name_zh_nodic;
    console.log(
      `${item.name_ja}: ` +
        `辞書あり[EN:${item.name_en ? "✓" : "✗"} ZH:${item.name_zh ? "✓" : "✗"}] ` +
        `辞書なし[EN:${item.name_en_nodic ? "✓" : "✗"} ZH:${item.name_zh_nodic ? "✓" : "✗"}]`
    );
  });

  // JSON出力
  const outputPath = path.join(
    __dirname,
    "..",
    "survey",
    "survey_translation_data.json"
  );
  const outputData = {
    exportedAt: new Date().toISOString(),
    restaurantIds,
    totalMatched: matchCount,
    partA_dishNames: SURVEY_ITEMS_PART_A.map(
      (name) => results[name] || { name_ja: name, error: "not found" }
    ),
    partB_descriptions: SURVEY_ITEMS_PART_B.map(
      (name) => results[name] || { name_ja: name, error: "not found" }
    ),
    partC_allergens: SURVEY_ITEMS_PART_C.map(
      (name) => results[name] || { name_ja: name, error: "not found" }
    ),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf-8");
  console.log(`\n✅ 出力完了: ${outputPath}`);

  process.exit(0);
}

exportSurveyData().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
