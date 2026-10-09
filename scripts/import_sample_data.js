/**
 * Firestore初期データインポートスクリプト
 *
 * 使用方法:
 * 1. Firebase Admin SDKのサービスアカウントキーをダウンロード
 * 2. 環境変数を設定: export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
 * 3. 実行: node scripts/import_sample_data.js
 */

const { createRequire } = require("node:module");
const functionsRequire = createRequire(
  require.resolve("../functions/package.json")
);
const { initializeApp } = functionsRequire("firebase-admin/app");
const { getFirestore, FieldValue } = functionsRequire(
  "firebase-admin/firestore"
);

// Firebase Admin初期化（サービスアカウントキーを使用）
initializeApp();

const db = getFirestore();

// ===== サンプルデータ定義 =====

// レストランデータ
const restaurantData = {
  id: "restaurant_01",
  name: "居酒屋さくら",
  description: "新鮮な魚介と日本酒が自慢の居酒屋です",
  address: "東京都渋谷区1-2-3",
  phone: "03-1234-5678",
  default_language: "ja",
  supported_languages: ["ja", "en", "zh"],
  is_active: true,
};

// テーブルデータ
const tablesData = [
  {
    id: "table_01",
    table_number: "1",
    capacity: 4,
    floor: 1,
    notes: "窓際の席",
  },
  {
    id: "table_02",
    table_number: "2",
    capacity: 2,
    floor: 1,
    notes: "カウンター席",
  },
  { id: "table_03", table_number: "3", capacity: 6, floor: 1, notes: "個室" },
  { id: "table_04", table_number: "4", capacity: 4, floor: 1, notes: null },
  { id: "table_05", table_number: "5", capacity: 4, floor: 2, notes: "2階席" },
];

// カテゴリデータ
const categoriesData = [
  {
    id: "category_01",
    name_ja: "前菜",
    name_en: "Appetizers",
    name_zh: "开胃菜",
    icon: "🍱",
    order: 1,
  },
  {
    id: "category_02",
    name_ja: "刺身・寿司",
    name_en: "Sashimi & Sushi",
    name_zh: "生鱼片和寿司",
    icon: "🍣",
    order: 2,
  },
  {
    id: "category_03",
    name_ja: "焼き物",
    name_en: "Grilled",
    name_zh: "烤物",
    icon: "🔥",
    order: 3,
  },
  {
    id: "category_04",
    name_ja: "揚げ物",
    name_en: "Fried",
    name_zh: "炸物",
    icon: "🍤",
    order: 4,
  },
  {
    id: "category_05",
    name_ja: "ご飯・麺",
    name_en: "Rice & Noodles",
    name_zh: "米饭和面条",
    icon: "🍜",
    order: 5,
  },
  {
    id: "category_06",
    name_ja: "デザート",
    name_en: "Desserts",
    name_zh: "甜点",
    icon: "🍰",
    order: 6,
  },
  {
    id: "category_07",
    name_ja: "ドリンク",
    name_en: "Drinks",
    name_zh: "饮料",
    icon: "🍶",
    order: 7,
  },
];

// メニューアイテムデータ
const menuItemsData = [
  // 前菜
  {
    id: "item_001",
    category_id: "category_01",
    name_ja: "枝豆",
    name_en: "Edamame",
    name_zh: "毛豆",
    description_ja: "新鮮な大豆を塩茹でした定番の一品",
    description_en: "Fresh soybeans boiled in salted water",
    description_zh: "用盐水煮的新鲜大豆",
    price: 400,
    allergens: ["soy"],
    is_popular: true,
    order: 1,
  },
  {
    id: "item_002",
    category_id: "category_01",
    name_ja: "冷奴",
    name_en: "Cold Tofu (Hiyayakko)",
    name_zh: "冷豆腐",
    description_ja: "なめらかな絹豆腐に薬味を添えて",
    description_en: "Smooth silken tofu with condiments",
    description_zh: "配调料的滑嫩绢豆腐",
    price: 450,
    allergens: ["soy"],
    is_popular: false,
    order: 2,
  },
  {
    id: "item_003",
    category_id: "category_01",
    name_ja: "出汁巻き玉子",
    name_en: "Japanese Rolled Omelette",
    name_zh: "日式蛋卷",
    description_ja: "ふんわりとした出汁香る玉子焼き",
    description_en: "Fluffy omelette flavored with dashi broth",
    description_zh: "蓬松的日式高汤鸡蛋卷",
    price: 600,
    allergens: ["egg"],
    is_popular: true,
    order: 3,
  },
  {
    id: "item_004",
    category_id: "category_01",
    name_ja: "たこわさび",
    name_en: "Wasabi Octopus",
    name_zh: "芥末章鱼",
    description_ja: "新鮮なタコとわさびの和え物",
    description_en: "Fresh octopus mixed with wasabi",
    description_zh: "新鲜章鱼配芥末",
    price: 550,
    allergens: [],
    is_popular: false,
    order: 4,
  },

  // 刺身・寿司
  {
    id: "item_005",
    category_id: "category_02",
    name_ja: "刺身盛り合わせ",
    name_en: "Assorted Sashimi Platter",
    name_zh: "拼盘生鱼片",
    description_ja: "本日の新鮮な魚介5種盛り",
    description_en: "Today's fresh seafood selection - 5 varieties",
    description_zh: "今日新鲜海鲜5种拼盘",
    price: 1500,
    allergens: ["fish"],
    is_popular: true,
    order: 1,
  },
  {
    id: "item_006",
    category_id: "category_02",
    name_ja: "マグロの赤身",
    name_en: "Lean Tuna Sashimi",
    name_zh: "金枪鱼赤肉",
    description_ja: "新鮮なマグロの赤身",
    description_en: "Fresh lean tuna",
    description_zh: "新鲜金枪鱼赤肉",
    price: 800,
    allergens: ["fish"],
    is_popular: false,
    order: 2,
  },
  {
    id: "item_007",
    category_id: "category_02",
    name_ja: "大トロ",
    name_en: "Fatty Tuna Sashimi",
    name_zh: "金枪鱼大肥",
    description_ja: "とろける食感の最高級部位",
    description_en: "Premium fatty tuna with melt-in-your-mouth texture",
    description_zh: "入口即化的顶级肥金枪鱼",
    price: 1200,
    allergens: ["fish"],
    is_popular: true,
    order: 3,
  },
  {
    id: "item_008",
    category_id: "category_02",
    name_ja: "炙りサーモン寿司",
    name_en: "Seared Salmon Sushi",
    name_zh: "炙烤三文鱼寿司",
    description_ja: "表面を炙った香ばしいサーモン寿司",
    description_en: "Sushi with lightly seared salmon",
    description_zh: "表面炙烤的香喷喷三文鱼寿司",
    price: 1200,
    allergens: ["fish", "soy"],
    is_popular: true,
    order: 4,
  },
  {
    id: "item_009",
    category_id: "category_02",
    name_ja: "握り寿司盛り合わせ",
    name_en: "Assorted Nigiri Sushi",
    name_zh: "拼盘握寿司",
    description_ja: "職人おすすめの握り8貫",
    description_en: "Chef's recommended 8-piece nigiri selection",
    description_zh: "厨师推荐8贯握寿司",
    price: 1800,
    allergens: ["fish", "soy", "wheat"],
    is_popular: true,
    order: 5,
  },

  // 焼き物
  {
    id: "item_010",
    category_id: "category_03",
    name_ja: "焼き鳥盛り合わせ",
    name_en: "Assorted Yakitori",
    name_zh: "拼盘烤鸡串",
    description_ja: "串焼き5本セット",
    description_en: "5-piece yakitori skewer set",
    description_zh: "5串烤鸡肉串套餐",
    price: 1200,
    allergens: [],
    is_popular: true,
    order: 1,
  },
  {
    id: "item_011",
    category_id: "category_03",
    name_ja: "つくね",
    name_en: "Chicken Meatball Skewer",
    name_zh: "鸡肉丸子串",
    description_ja: "ジューシーな鶏つくね",
    description_en: "Juicy chicken meatball",
    description_zh: "多汁的鸡肉丸子",
    price: 450,
    allergens: ["egg"],
    is_popular: false,
    order: 2,
  },
  {
    id: "item_012",
    category_id: "category_03",
    name_ja: "焼き魚（サバ）",
    name_en: "Grilled Mackerel",
    name_zh: "烤鲭鱼",
    description_ja: "脂の乗った塩焼きサバ",
    description_en: "Salt-grilled mackerel with rich fat",
    description_zh: "肥美的盐烤鲭鱼",
    price: 800,
    allergens: ["fish"],
    is_popular: false,
    order: 3,
  },

  // 揚げ物
  {
    id: "item_013",
    category_id: "category_04",
    name_ja: "唐揚げ",
    name_en: "Fried Chicken (Karaage)",
    name_zh: "炸鸡",
    description_ja: "サクサクジューシーな鶏の唐揚げ",
    description_en: "Crispy and juicy Japanese fried chicken",
    description_zh: "酥脆多汁的日式炸鸡",
    price: 700,
    allergens: ["wheat", "soy"],
    is_popular: true,
    order: 1,
  },
  {
    id: "item_014",
    category_id: "category_04",
    name_ja: "とんかつ",
    name_en: "Pork Cutlet (Tonkatsu)",
    name_zh: "炸猪排",
    description_ja: "サクサクの衣とジューシーな豚肉",
    description_en: "Crispy breaded pork cutlet",
    description_zh: "酥脆面包糠炸猪排",
    price: 900,
    allergens: ["wheat", "egg"],
    is_popular: true,
    order: 2,
  },
  {
    id: "item_015",
    category_id: "category_04",
    name_ja: "天ぷら盛り合わせ",
    name_en: "Assorted Tempura",
    name_zh: "拼盘天妇罗",
    description_ja: "エビと季節野菜の天ぷら",
    description_en: "Shrimp and seasonal vegetable tempura",
    description_zh: "虾和时令蔬菜天妇罗",
    price: 1000,
    allergens: ["shrimp", "wheat"],
    is_popular: true,
    order: 3,
  },

  // ご飯・麺
  {
    id: "item_016",
    category_id: "category_05",
    name_ja: "ラーメン",
    name_en: "Ramen",
    name_zh: "拉面",
    description_ja: "濃厚スープの醤油ラーメン",
    description_en: "Soy sauce ramen with rich broth",
    description_zh: "浓郁酱油汤底拉面",
    price: 850,
    allergens: ["wheat", "egg", "soy"],
    is_popular: true,
    order: 1,
  },
  {
    id: "item_017",
    category_id: "category_05",
    name_ja: "親子丼",
    name_en: "Chicken & Egg Bowl",
    name_zh: "亲子盖饭",
    description_ja: "ふわふわ卵の親子丼",
    description_en: "Rice bowl with chicken and fluffy eggs",
    description_zh: "蓬松鸡蛋亲子盖饭",
    price: 850,
    allergens: ["egg", "soy", "wheat"],
    is_popular: true,
    order: 2,
  },
  {
    id: "item_018",
    category_id: "category_05",
    name_ja: "海鮮丼",
    name_en: "Seafood Bowl",
    name_zh: "海鲜盖饭",
    description_ja: "新鮮な刺身をたっぷり乗せた丼",
    description_en: "Rice bowl topped with fresh sashimi",
    description_zh: "盖满新鲜生鱼片的盖饭",
    price: 1400,
    allergens: ["fish", "soy", "wheat"],
    is_popular: true,
    order: 3,
  },

  // デザート
  {
    id: "item_019",
    category_id: "category_06",
    name_ja: "抹茶アイス",
    name_en: "Matcha Ice Cream",
    name_zh: "抹茶冰淇淋",
    description_ja: "濃厚抹茶のアイスクリーム",
    description_en: "Rich matcha green tea ice cream",
    description_zh: "浓郁抹茶冰淇淋",
    price: 500,
    allergens: ["milk"],
    is_popular: true,
    order: 1,
  },
  {
    id: "item_020",
    category_id: "category_06",
    name_ja: "わらび餅",
    name_en: "Warabimochi",
    name_zh: "蕨饼",
    description_ja: "もちもちのわらび餅、黒蜜きなこ添え",
    description_en: "Chewy bracken starch cake with brown sugar syrup",
    description_zh: "QQ弹弹的蕨饼配黑糖蜜",
    price: 550,
    allergens: ["soy"],
    is_popular: false,
    order: 2,
  },

  // ドリンク
  {
    id: "item_021",
    category_id: "category_07",
    name_ja: "生ビール",
    name_en: "Draft Beer",
    name_zh: "生啤酒",
    description_ja: "キンキンに冷えた生ビール",
    description_en: "Ice-cold draft beer",
    description_zh: "冰镇生啤酒",
    price: 550,
    allergens: [],
    is_popular: true,
    order: 1,
  },
  {
    id: "item_022",
    category_id: "category_07",
    name_ja: "日本酒（冷酒）",
    name_en: "Japanese Sake (Cold)",
    name_zh: "日本清酒(冷)",
    description_ja: "すっきりとした冷酒",
    description_en: "Refreshing cold sake",
    description_zh: "清爽的冷清酒",
    price: 700,
    allergens: [],
    is_popular: true,
    order: 2,
  },
  {
    id: "item_023",
    category_id: "category_07",
    name_ja: "ウーロン茶",
    name_en: "Oolong Tea",
    name_zh: "乌龙茶",
    description_ja: "さっぱりウーロン茶",
    description_en: "Refreshing oolong tea",
    description_zh: "清爽乌龙茶",
    price: 350,
    allergens: [],
    is_popular: false,
    order: 3,
  },
  {
    id: "item_024",
    category_id: "category_07",
    name_ja: "緑茶",
    name_en: "Green Tea",
    name_zh: "绿茶",
    description_ja: "温かい緑茶",
    description_en: "Hot green tea",
    description_zh: "热绿茶",
    price: 300,
    allergens: [],
    is_popular: false,
    order: 4,
  },
];

// 専門用語辞書データ
const dictionaryData = [
  // 調理法
  {
    id: "dict_001",
    term_ja: "炙り",
    term_en: "seared",
    term_zh: "炙烤",
    reading: "あぶり",
    category: "cooking_method",
    priority: 2,
  },
  {
    id: "dict_002",
    term_ja: "焼く",
    term_en: "grill",
    term_zh: "烤",
    reading: "やく",
    category: "cooking_method",
    priority: 2,
  },
  {
    id: "dict_003",
    term_ja: "揚げる",
    term_en: "deep-fry",
    term_zh: "油炸",
    reading: "あげる",
    category: "cooking_method",
    priority: 2,
  },
  {
    id: "dict_004",
    term_ja: "茹でる",
    term_en: "boil",
    term_zh: "煮",
    reading: "ゆでる",
    category: "cooking_method",
    priority: 2,
  },
  {
    id: "dict_005",
    term_ja: "蒸す",
    term_en: "steam",
    term_zh: "蒸",
    reading: "むす",
    category: "cooking_method",
    priority: 2,
  },

  // 食材
  {
    id: "dict_006",
    term_ja: "サーモン",
    term_en: "salmon",
    term_zh: "三文鱼",
    reading: "さーもん",
    category: "ingredient",
    priority: 2,
  },
  {
    id: "dict_007",
    term_ja: "マグロ",
    term_en: "tuna",
    term_zh: "金枪鱼",
    reading: "まぐろ",
    category: "ingredient",
    priority: 2,
  },
  {
    id: "dict_008",
    term_ja: "大トロ",
    term_en: "fatty tuna",
    term_zh: "金枪鱼大肥",
    reading: "おおとろ",
    category: "ingredient",
    priority: 1,
  },
  {
    id: "dict_009",
    term_ja: "エビ",
    term_en: "shrimp",
    term_zh: "虾",
    reading: "えび",
    category: "ingredient",
    priority: 2,
  },
  {
    id: "dict_010",
    term_ja: "豆腐",
    term_en: "tofu",
    term_zh: "豆腐",
    reading: "とうふ",
    category: "ingredient",
    priority: 2,
  },

  // 料理名
  {
    id: "dict_011",
    term_ja: "寿司",
    term_en: "sushi",
    term_zh: "寿司",
    reading: "すし",
    category: "dish_name",
    priority: 1,
  },
  {
    id: "dict_012",
    term_ja: "刺身",
    term_en: "sashimi",
    term_zh: "生鱼片",
    reading: "さしみ",
    category: "dish_name",
    priority: 1,
  },
  {
    id: "dict_013",
    term_ja: "天ぷら",
    term_en: "tempura",
    term_zh: "天妇罗",
    reading: "てんぷら",
    category: "dish_name",
    priority: 1,
  },
  {
    id: "dict_014",
    term_ja: "ラーメン",
    term_en: "ramen",
    term_zh: "拉面",
    reading: "らーめん",
    category: "dish_name",
    priority: 1,
  },
  {
    id: "dict_015",
    term_ja: "唐揚げ",
    term_en: "karaage",
    term_zh: "炸鸡",
    reading: "からあげ",
    category: "dish_name",
    priority: 1,
  },

  // アレルゲン
  {
    id: "dict_016",
    term_ja: "小麦",
    term_en: "wheat",
    term_zh: "小麦",
    reading: "こむぎ",
    category: "allergen",
    priority: 1,
  },
  {
    id: "dict_017",
    term_ja: "卵",
    term_en: "egg",
    term_zh: "鸡蛋",
    reading: "たまご",
    category: "allergen",
    priority: 1,
  },
  {
    id: "dict_018",
    term_ja: "乳",
    term_en: "milk",
    term_zh: "牛奶",
    reading: "にゅう",
    category: "allergen",
    priority: 1,
  },
  {
    id: "dict_019",
    term_ja: "大豆",
    term_en: "soybean",
    term_zh: "大豆",
    reading: "だいず",
    category: "allergen",
    priority: 1,
  },
  {
    id: "dict_020",
    term_ja: "ゴマ",
    term_en: "sesame",
    term_zh: "芝麻",
    reading: "ごま",
    category: "allergen",
    priority: 1,
  },
];

// ===== インポート関数 =====

async function importData() {
  console.log("🚀 Starting data import...\n");

  try {
    // 1. レストランを作成
    console.log("📍 Creating restaurant...");
    await db
      .collection("restaurants")
      .doc(restaurantData.id)
      .set({
        ...restaurantData,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    console.log(`   ✅ Restaurant created: ${restaurantData.name}\n`);

    // 2. テーブルを作成
    console.log("🪑 Creating tables...");
    for (const table of tablesData) {
      await db
        .collection("restaurants")
        .doc(restaurantData.id)
        .collection("tables")
        .doc(table.id)
        .set({
          ...table,
          qr_code: `${restaurantData.id}/${table.id}`,
          status: "available",
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
    }
    console.log(`   ✅ ${tablesData.length} tables created\n`);

    // 3. カテゴリを作成
    console.log("📂 Creating categories...");
    for (const category of categoriesData) {
      await db
        .collection("restaurants")
        .doc(restaurantData.id)
        .collection("menu_categories")
        .doc(category.id)
        .set({
          ...category,
          is_available: true,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
    }
    console.log(`   ✅ ${categoriesData.length} categories created\n`);

    // 4. メニューアイテムを作成
    console.log("🍽️  Creating menu items...");
    for (const item of menuItemsData) {
      await db
        .collection("restaurants")
        .doc(restaurantData.id)
        .collection("menu_items")
        .doc(item.id)
        .set({
          ...item,
          is_available: true,
          spicy_level: item.spicy_level || 0,
          cooking_time: item.cooking_time || null,
          calories: item.calories || null,
          image_url: null,
          tags: item.tags || [],
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
    }
    console.log(`   ✅ ${menuItemsData.length} menu items created\n`);

    // 5. 辞書データを作成
    console.log("📖 Creating dictionary entries...");
    for (const entry of dictionaryData) {
      await db
        .collection("dictionary")
        .doc(entry.id)
        .set({
          ...entry,
          subcategory: entry.subcategory || null,
          notes: entry.notes || null,
          usage_count: 0,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
    }
    console.log(`   ✅ ${dictionaryData.length} dictionary entries created\n`);

    console.log("🎉 Data import completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Restaurant: 1`);
    console.log(`   - Tables: ${tablesData.length}`);
    console.log(`   - Categories: ${categoriesData.length}`);
    console.log(`   - Menu Items: ${menuItemsData.length}`);
    console.log(`   - Dictionary Entries: ${dictionaryData.length}`);
  } catch (error) {
    console.error("❌ Error importing data:", error);
    process.exit(1);
  }
}

// 実行
importData().then(() => {
  console.log("\n✅ Script finished. Exiting...");
  process.exit(0);
});
