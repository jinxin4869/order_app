/**
 * 専門用語辞書データ投入スクリプト
 *
 * dictionary_design.md の50エントリをFirestoreの dictionary コレクションに投入します。
 * restaurants 等の他コレクションには一切影響しません。
 *
 * 使用方法:
 *   cd scripts/data-tools
 *   node seedDictionary.js           # 辞書データを投入
 *   node seedDictionary.js --clear   # 既存辞書を削除してから投入
 */

const admin = require("firebase-admin");

// Firebase Admin SDK の初期化（seedData.jsと同じ方式）
const serviceAccount = require("./credentials.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ===== 設計書(dictionary_design.md)の50エントリ =====

const dictionaryData = [
  // --- 5.1 料理名（dish_name）- 15エントリ ---
  {
    id: "dict_001",
    term_ja: "寿司",
    reading: "すし",
    term_en: "Sushi",
    term_zh: "寿司",
    category: "dish_name",
    subcategory: "rice",
    priority: 1,
    notes: "シャリに魚介を乗せた料理",
  },
  {
    id: "dict_002",
    term_ja: "刺身",
    reading: "さしみ",
    term_en: "Sashimi",
    term_zh: "生鱼片",
    category: "dish_name",
    subcategory: "raw",
    priority: 1,
    notes: "生の魚介をスライスした料理",
  },
  {
    id: "dict_003",
    term_ja: "天ぷら",
    reading: "てんぷら",
    term_en: "Tempura",
    term_zh: "天妇罗",
    category: "dish_name",
    subcategory: "fried",
    priority: 1,
    notes: "衣をつけて揚げた料理",
  },
  {
    id: "dict_004",
    term_ja: "ラーメン",
    reading: "らーめん",
    term_en: "Ramen",
    term_zh: "拉面",
    category: "dish_name",
    subcategory: "noodle",
    priority: 1,
    notes: "中華風麺料理",
  },
  {
    id: "dict_005",
    term_ja: "うどん",
    reading: "うどん",
    term_en: "Udon",
    term_zh: "乌冬面",
    category: "dish_name",
    subcategory: "noodle",
    priority: 1,
    notes: "太い日本の麺",
  },
  {
    id: "dict_006",
    term_ja: "そば",
    reading: "そば",
    term_en: "Soba",
    term_zh: "荞麦面",
    category: "dish_name",
    subcategory: "noodle",
    priority: 1,
    notes: "そば粉を使った麺（アレルゲン注意）",
  },
  {
    id: "dict_007",
    term_ja: "焼き鳥",
    reading: "やきとり",
    term_en: "Yakitori",
    term_zh: "烤鸡肉串",
    category: "dish_name",
    subcategory: "grilled",
    priority: 2,
    notes: "鶏肉の串焼き",
  },
  {
    id: "dict_008",
    term_ja: "唐揚げ",
    reading: "からあげ",
    term_en: "Karaage",
    term_zh: "炸鸡",
    category: "dish_name",
    subcategory: "fried",
    priority: 2,
    notes: "鶏肉の揚げ物",
  },
  {
    id: "dict_009",
    term_ja: "とんかつ",
    reading: "とんかつ",
    term_en: "Tonkatsu",
    term_zh: "炸猪排",
    category: "dish_name",
    subcategory: "fried",
    priority: 2,
    notes: "豚肉のカツレツ",
  },
  {
    id: "dict_010",
    term_ja: "牛丼",
    reading: "ぎゅうどん",
    term_en: "Gyudon",
    term_zh: "牛肉盖饭",
    category: "dish_name",
    subcategory: "rice",
    priority: 2,
    notes: "牛肉の煮込みをご飯に乗せた丼",
  },
  {
    id: "dict_011",
    term_ja: "味噌汁",
    reading: "みそしる",
    term_en: "Miso Soup",
    term_zh: "味噌汤",
    category: "dish_name",
    subcategory: "soup",
    priority: 2,
    notes: "味噌ベースのスープ",
  },
  {
    id: "dict_012",
    term_ja: "炙りサーモン",
    reading: "あぶりさーもん",
    term_en: "Seared Salmon",
    term_zh: "炙烤三文鱼",
    category: "dish_name",
    subcategory: "grilled",
    priority: 2,
    notes: "表面を炙ったサーモン",
  },
  {
    id: "dict_013",
    term_ja: "大トロ",
    reading: "おおとろ",
    term_en: "Fatty Tuna",
    term_zh: "金枪鱼大肥",
    category: "dish_name",
    subcategory: "raw",
    priority: 1,
    notes: "マグロの最も脂の多い部位",
  },
  {
    id: "dict_014",
    term_ja: "海鮮丼",
    reading: "かいせんどん",
    term_en: "Seafood Bowl",
    term_zh: "海鲜盖饭",
    category: "dish_name",
    subcategory: "rice",
    priority: 2,
    notes: "刺身を乗せた丼",
  },
  {
    id: "dict_015",
    term_ja: "すき焼き",
    reading: "すきやき",
    term_en: "Sukiyaki",
    term_zh: "寿喜烧",
    category: "dish_name",
    subcategory: "hotpot",
    priority: 2,
    notes: "甘辛い牛肉の鍋料理",
  },

  // --- 5.2 食材（ingredient）- 15エントリ ---
  {
    id: "dict_016",
    term_ja: "サーモン",
    reading: "さーもん",
    term_en: "Salmon",
    term_zh: "三文鱼",
    category: "ingredient",
    subcategory: "seafood",
    priority: 2,
    notes: "鮭",
  },
  {
    id: "dict_017",
    term_ja: "マグロ",
    reading: "まぐろ",
    term_en: "Tuna",
    term_zh: "金枪鱼",
    category: "ingredient",
    subcategory: "seafood",
    priority: 2,
    notes: "鮪",
  },
  {
    id: "dict_018",
    term_ja: "エビ",
    reading: "えび",
    term_en: "Shrimp",
    term_zh: "虾",
    category: "ingredient",
    subcategory: "seafood",
    priority: 1,
    notes: "アレルゲン",
  },
  {
    id: "dict_019",
    term_ja: "イカ",
    reading: "いか",
    term_en: "Squid",
    term_zh: "鱿鱼",
    category: "ingredient",
    subcategory: "seafood",
    priority: 2,
    notes: "烏賊",
  },
  {
    id: "dict_020",
    term_ja: "タコ",
    reading: "たこ",
    term_en: "Octopus",
    term_zh: "章鱼",
    category: "ingredient",
    subcategory: "seafood",
    priority: 2,
    notes: "蛸",
  },
  {
    id: "dict_021",
    term_ja: "カニ",
    reading: "かに",
    term_en: "Crab",
    term_zh: "蟹",
    category: "ingredient",
    subcategory: "seafood",
    priority: 1,
    notes: "アレルゲン",
  },
  {
    id: "dict_022",
    term_ja: "牛肉",
    reading: "ぎゅうにく",
    term_en: "Beef",
    term_zh: "牛肉",
    category: "ingredient",
    subcategory: "meat",
    priority: 2,
    notes: null,
  },
  {
    id: "dict_023",
    term_ja: "豚肉",
    reading: "ぶたにく",
    term_en: "Pork",
    term_zh: "猪肉",
    category: "ingredient",
    subcategory: "meat",
    priority: 2,
    notes: null,
  },
  {
    id: "dict_024",
    term_ja: "鶏肉",
    reading: "とりにく",
    term_en: "Chicken",
    term_zh: "鸡肉",
    category: "ingredient",
    subcategory: "meat",
    priority: 2,
    notes: null,
  },
  {
    id: "dict_025",
    term_ja: "卵",
    reading: "たまご",
    term_en: "Egg",
    term_zh: "鸡蛋",
    category: "ingredient",
    subcategory: "protein",
    priority: 1,
    notes: "アレルゲン",
  },
  {
    id: "dict_026",
    term_ja: "豆腐",
    reading: "とうふ",
    term_en: "Tofu",
    term_zh: "豆腐",
    category: "ingredient",
    subcategory: "protein",
    priority: 2,
    notes: "大豆製品",
  },
  {
    id: "dict_027",
    term_ja: "米",
    reading: "こめ",
    term_en: "Rice",
    term_zh: "米",
    category: "ingredient",
    subcategory: "grain",
    priority: 2,
    notes: null,
  },
  {
    id: "dict_028",
    term_ja: "小麦粉",
    reading: "こむぎこ",
    term_en: "Wheat Flour",
    term_zh: "小麦粉",
    category: "ingredient",
    subcategory: "grain",
    priority: 1,
    notes: "アレルゲン",
  },
  {
    id: "dict_029",
    term_ja: "醤油",
    reading: "しょうゆ",
    term_en: "Soy Sauce",
    term_zh: "酱油",
    category: "ingredient",
    subcategory: "seasoning",
    priority: 2,
    notes: "大豆・小麦含む",
  },
  {
    id: "dict_030",
    term_ja: "味噌",
    reading: "みそ",
    term_en: "Miso",
    term_zh: "味噌",
    category: "ingredient",
    subcategory: "seasoning",
    priority: 2,
    notes: "発酵大豆ペースト",
  },

  // --- 5.3 調理法（cooking_method）- 10エントリ ---
  {
    id: "dict_031",
    term_ja: "焼く",
    reading: "やく",
    term_en: "Grill",
    term_zh: "烤",
    category: "cooking_method",
    subcategory: "grilling",
    priority: 2,
    notes: null,
  },
  {
    id: "dict_032",
    term_ja: "炙る",
    reading: "あぶる",
    term_en: "Sear",
    term_zh: "炙烤",
    category: "cooking_method",
    subcategory: "grilling",
    priority: 2,
    notes: "表面を軽く焼く",
  },
  {
    id: "dict_033",
    term_ja: "揚げる",
    reading: "あげる",
    term_en: "Deep-fry",
    term_zh: "油炸",
    category: "cooking_method",
    subcategory: "frying",
    priority: 2,
    notes: null,
  },
  {
    id: "dict_034",
    term_ja: "茹でる",
    reading: "ゆでる",
    term_en: "Boil",
    term_zh: "煮",
    category: "cooking_method",
    subcategory: "boiling",
    priority: 2,
    notes: "お湯で加熱",
  },
  {
    id: "dict_035",
    term_ja: "煮る",
    reading: "にる",
    term_en: "Simmer",
    term_zh: "炖",
    category: "cooking_method",
    subcategory: "simmering",
    priority: 2,
    notes: "じっくり煮込む",
  },
  {
    id: "dict_036",
    term_ja: "蒸す",
    reading: "むす",
    term_en: "Steam",
    term_zh: "蒸",
    category: "cooking_method",
    subcategory: "steaming",
    priority: 2,
    notes: null,
  },
  {
    id: "dict_037",
    term_ja: "炒める",
    reading: "いためる",
    term_en: "Stir-fry",
    term_zh: "炒",
    category: "cooking_method",
    subcategory: "frying",
    priority: 2,
    notes: null,
  },
  {
    id: "dict_038",
    term_ja: "生",
    reading: "なま",
    term_en: "Raw",
    term_zh: "生",
    category: "cooking_method",
    subcategory: "raw",
    priority: 1,
    notes: "加熱していない",
  },
  {
    id: "dict_039",
    term_ja: "照り焼き",
    reading: "てりやき",
    term_en: "Teriyaki Glaze",
    term_zh: "照烧",
    category: "cooking_method",
    subcategory: "grilling",
    priority: 2,
    notes: "甘辛いタレで焼く",
  },
  {
    id: "dict_040",
    term_ja: "唐揚げ",
    reading: "からあげ",
    term_en: "Deep-fried",
    term_zh: "炸",
    category: "cooking_method",
    subcategory: "frying",
    priority: 2,
    notes: "粉をまぶして揚げる",
  },

  // --- 5.4 アレルゲン（allergen）- 10エントリ ---
  {
    id: "dict_041",
    term_ja: "小麦",
    reading: "こむぎ",
    term_en: "Wheat",
    term_zh: "小麦",
    category: "allergen",
    subcategory: "grain",
    priority: 1,
    notes: "7大アレルゲン",
  },
  {
    id: "dict_042",
    term_ja: "卵",
    reading: "たまご",
    term_en: "Egg",
    term_zh: "鸡蛋",
    category: "allergen",
    subcategory: "protein",
    priority: 1,
    notes: "7大アレルゲン",
  },
  {
    id: "dict_043",
    term_ja: "乳",
    reading: "にゅう",
    term_en: "Milk",
    term_zh: "牛奶",
    category: "allergen",
    subcategory: "dairy",
    priority: 1,
    notes: "7大アレルゲン",
  },
  {
    id: "dict_044",
    term_ja: "そば",
    reading: "そば",
    term_en: "Buckwheat",
    term_zh: "荞麦",
    category: "allergen",
    subcategory: "grain",
    priority: 1,
    notes: "7大アレルゲン",
  },
  {
    id: "dict_045",
    term_ja: "ピーナッツ",
    reading: "ぴーなっつ",
    term_en: "Peanut",
    term_zh: "花生",
    category: "allergen",
    subcategory: "nut",
    priority: 1,
    notes: "7大アレルゲン",
  },
  {
    id: "dict_046",
    term_ja: "エビ",
    reading: "えび",
    term_en: "Shrimp",
    term_zh: "虾",
    category: "allergen",
    subcategory: "seafood",
    priority: 1,
    notes: "7大アレルゲン",
  },
  {
    id: "dict_047",
    term_ja: "カニ",
    reading: "かに",
    term_en: "Crab",
    term_zh: "蟹",
    category: "allergen",
    subcategory: "seafood",
    priority: 1,
    notes: "7大アレルゲン",
  },
  {
    id: "dict_048",
    term_ja: "大豆",
    reading: "だいず",
    term_en: "Soybean",
    term_zh: "大豆",
    category: "allergen",
    subcategory: "legume",
    priority: 1,
    notes: "推奨表示品目",
  },
  {
    id: "dict_049",
    term_ja: "ゴマ",
    reading: "ごま",
    term_en: "Sesame",
    term_zh: "芝麻",
    category: "allergen",
    subcategory: "seed",
    priority: 1,
    notes: "推奨表示品目",
  },
  {
    id: "dict_050",
    term_ja: "魚",
    reading: "さかな",
    term_en: "Fish",
    term_zh: "鱼",
    category: "allergen",
    subcategory: "seafood",
    priority: 1,
    notes: "推奨表示品目",
  },
];

// ===== 投入関数 =====

async function seedDictionary() {
  console.log("📖 専門用語辞書データの投入を開始します...\n");

  // カテゴリ別の集計
  const categoryCounts = {};
  dictionaryData.forEach((entry) => {
    categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
  });

  console.log("📊 投入データの構成:");
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count}件`);
  });
  console.log(`   合計: ${dictionaryData.length}件\n`);

  // バッチ書き込み（Firestoreのバッチは500件まで）
  const batch = db.batch();

  for (const entry of dictionaryData) {
    const docRef = db.collection("dictionary").doc(entry.id);
    const { id, ...data } = entry;
    batch.set(docRef, {
      ...data,
      usage_count: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log("✅ 辞書データの投入が完了しました！");
  console.log(
    `\n📖 Firestore 'dictionary' コレクションに ${dictionaryData.length} 件のエントリが登録されました`
  );
}

async function clearDictionary() {
  console.log("🗑️  既存の辞書データを削除中...\n");

  const snapshot = await db.collection("dictionary").get();

  if (snapshot.empty) {
    console.log("   辞書コレクションは空です（削除するデータなし）\n");
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`   ✅ ${snapshot.size}件の辞書エントリを削除しました\n`);
}

// ===== メイン処理 =====

const args = process.argv.slice(2);

async function main() {
  try {
    if (args.includes("--clear")) {
      await clearDictionary();
    }

    await seedDictionary();
    process.exit(0);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  }
}

main();
