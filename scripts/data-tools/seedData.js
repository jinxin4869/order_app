/**
 * Firestore データ投入スクリプト（サブコレクション対応版）
 *
 * 使用方法:
 * 1. Firebase Admin SDK の credentials.json を scripts/data-tools/ に配置
 * 2. npm install (CSVパーサーのインストール)
 * 3. npm run seed (または node scripts/data-tools/seedData.js)
 *
 * データ構造:
 * restaurants/{restaurantId}
 *   ├─ menu_categories/{categoryId}
 *   ├─ menu_items/{itemId}
 *   └─ tables/{tableId}
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// Firebase Admin SDK の初期化
const serviceAccount = require("./credentials.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// プレースホルダー画像URL生成関数（Lorem Picsum使用）
function getPlaceholderImage(dishName) {
  // 料理名をシードとして使用（同じ料理には同じ画像）
  const seed = Buffer.from(dishName)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 20);
  return `https://picsum.photos/seed/${seed}/400/300`;
}

/**
 * CSVファイルを読み込む
 */
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  CSVファイルが見つかりません: ${filePath}`);
      resolve([]);
      return;
    }
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

/**
 * アレルゲン情報をマッピング
 */
function mapAllergens(subcategory, dishName) {
  const allergens = [];

  if (
    subcategory === "fish" ||
    dishName.includes("魚") ||
    dishName.includes("刺身")
  ) {
    allergens.push("fish");
  }
  if (
    subcategory === "seafood" ||
    dishName.includes("エビ") ||
    dishName.includes("海老")
  ) {
    allergens.push("shrimp");
  }
  if (dishName.includes("カニ") || dishName.includes("蟹")) {
    allergens.push("crab");
  }
  if (dishName.includes("そば")) {
    allergens.push("soba");
  }
  if (
    dishName.includes("豆腐") ||
    dishName.includes("納豆") ||
    dishName.includes("枝豆")
  ) {
    allergens.push("soy");
  }
  if (dishName.includes("卵") || dishName.includes("玉子")) {
    allergens.push("egg");
  }
  if (
    dishName.includes("天ぷら") ||
    dishName.includes("唐揚げ") ||
    dishName.includes("フライ")
  ) {
    allergens.push("wheat");
    allergens.push("egg");
  }
  if (dishName.includes("うどん") || dishName.includes("ラーメン")) {
    allergens.push("wheat");
  }
  if (
    dishName.includes("チーズ") ||
    dishName.includes("ミルク") ||
    dishName.includes("アイス")
  ) {
    allergens.push("milk");
  }
  if (dishName.includes("ごま") || dishName.includes("ゴマ")) {
    allergens.push("sesame");
  }
  if (dishName.includes("ピーナッツ") || dishName.includes("落花生")) {
    allergens.push("peanut");
  }

  // 注: 'allergen' は ALLERGENS 定数に定義されていないため使用しない
  // notes にアレルゲン情報がある場合でも、具体的なタイプが不明な場合は追加しない

  return [...new Set(allergens)];
}

/**
 * レストランデータ
 */
const restaurantsData = [
  {
    id: "rest001",
    name: "和食レストラン 桜",
    name_en: "Sakura Japanese Restaurant",
    name_zh: "樱花日本料理",
    description: "本格的な和食を提供する人気のレストラン",
    description_en: "Authentic Japanese cuisine restaurant",
    description_zh: "提供正宗日本料理的人气餐厅",
    address: "東京都渋谷区桜丘町1-2-3",
    phone: "03-1234-5678",
    is_active: true,
    default_language: "ja",
    supported_languages: ["ja", "en", "zh"],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: "rest003",
    name: "寿司処 鮨一",
    name_en: "Sushidokoro Sushi-ichi",
    name_zh: "寿司处 鮨一",
    description: "職人が握る本格江戸前寿司",
    description_en: "Authentic Edomae sushi by master chefs",
    description_zh: "师傅精心制作的正宗江户前寿司",
    address: "東京都中央区銀座4-5-6",
    phone: "03-3456-7890",
    is_active: true,
    default_language: "ja",
    supported_languages: ["ja", "en", "zh"],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: "rest004",
    name: "カフェ＆ダイニング HANA",
    name_en: "Cafe & Dining HANA",
    name_zh: "HANA咖啡餐厅",
    description: "落ち着いた雰囲気のカフェダイニング",
    description_en: "Relaxed atmosphere cafe and dining",
    description_zh: "氛围轻松的咖啡餐厅",
    address: "東京都世田谷区三軒茶屋2-3-4",
    phone: "03-4567-8901",
    is_active: true,
    default_language: "ja",
    supported_languages: ["ja", "en", "zh"],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  },
];

/**
 * テーブルデータを生成
 */
function generateTablesData(restaurantId, tableCount) {
  const tables = [];
  for (let i = 1; i <= tableCount; i++) {
    tables.push({
      id: `table${String(i).padStart(3, "0")}`,
      table_number: String(i),
      capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
      status: "available",
      qr_code: `${restaurantId}/table${String(i).padStart(3, "0")}`,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return tables;
}

/**
 * カテゴリデータ
 */
const categoriesTemplate = [
  {
    id: "cat_appetizer",
    name_ja: "前菜",
    name_en: "Appetizers",
    name_zh: "开胃菜",
    icon: "🥗",
    order: 1,
  },
  {
    id: "cat_sashimi",
    name_ja: "刺身",
    name_en: "Sashimi",
    name_zh: "生鱼片",
    icon: "🍣",
    order: 2,
  },
  {
    id: "cat_sushi",
    name_ja: "寿司",
    name_en: "Sushi",
    name_zh: "寿司",
    icon: "🍱",
    order: 3,
  },
  {
    id: "cat_grilled",
    name_ja: "焼き物",
    name_en: "Grilled",
    name_zh: "烤物",
    icon: "🍖",
    order: 4,
  },
  {
    id: "cat_fried",
    name_ja: "揚げ物",
    name_en: "Fried",
    name_zh: "炸物",
    icon: "🍤",
    order: 5,
  },
  {
    id: "cat_simmered",
    name_ja: "煮物",
    name_en: "Simmered",
    name_zh: "炖菜",
    icon: "🍲",
    order: 6,
  },
  {
    id: "cat_noodle",
    name_ja: "麺類",
    name_en: "Noodles",
    name_zh: "面条",
    icon: "🍜",
    order: 7,
  },
  {
    id: "cat_rice",
    name_ja: "ご飯・丼",
    name_en: "Rice & Bowls",
    name_zh: "米饭和盖饭",
    icon: "🍚",
    order: 8,
  },
  {
    id: "cat_hotpot",
    name_ja: "鍋物",
    name_en: "Hot Pot",
    name_zh: "火锅",
    icon: "🥘",
    order: 9,
  },
  {
    id: "cat_soup",
    name_ja: "汁物",
    name_en: "Soups",
    name_zh: "汤品",
    icon: "🥣",
    order: 10,
  },
  {
    id: "cat_dessert",
    name_ja: "デザート",
    name_en: "Desserts",
    name_zh: "甜点",
    icon: "🍰",
    order: 11,
  },
  {
    id: "cat_drink",
    name_ja: "飲み物",
    name_en: "Beverages",
    name_zh: "饮料",
    icon: "🍺",
    order: 12,
  },
  {
    id: "cat_pasta",
    name_ja: "パスタ",
    name_en: "Pasta",
    name_zh: "意大利面",
    icon: "🍝",
    order: 13,
  },
  {
    id: "cat_sandwich",
    name_ja: "サンドイッチ",
    name_en: "Sandwich",
    name_zh: "三明治",
    icon: "🥪",
    order: 14,
  },
  {
    id: "cat_salad",
    name_ja: "サラダ",
    name_en: "Salad",
    name_zh: "沙拉",
    icon: "🥗",
    order: 15,
  },
  {
    id: "cat_cafe_drink",
    name_ja: "カフェドリンク",
    name_en: "Café Drinks",
    name_zh: "咖啡饮品",
    icon: "☕",
    order: 16,
  },
];

// レストラン別のカテゴリ設定
const restaurantConfig = {
  rest001: {
    // 和食レストラン: 和食フルメニュー（刺身・寿司は寿司処に専属）
    categories: [
      "cat_appetizer",
      "cat_grilled",
      "cat_fried",
      "cat_simmered",
      "cat_noodle",
      "cat_rice",
      "cat_hotpot",
      "cat_soup",
      "cat_dessert",
      "cat_drink",
    ],
  },
  rest003: {
    // 寿司処: 刺身・寿司特化、軽い前菜・汁物・デザート・酒
    categories: [
      "cat_appetizer",
      "cat_sashimi",
      "cat_sushi",
      "cat_soup",
      "cat_dessert",
      "cat_drink",
    ],
  },
  rest004: {
    // カフェ: パスタ・サンド・サラダ・デザート・カフェドリンク
    categories: [
      "cat_salad",
      "cat_sandwich",
      "cat_pasta",
      "cat_dessert",
      "cat_cafe_drink",
      "cat_drink",
    ],
  },
};

/**
 * 実際の料理メニューデータを生成
 */
function generateActualMenuItems(dishData, restaurantId) {
  const menuItems = [];
  let order = 1;

  const sashimiItems = dishData.filter(
    (d) => d.category === "sushi" && d.subcategory === "fish"
  );
  const sushiTypes = dishData.filter(
    (d) =>
      d.category === "sushi" &&
      (d.subcategory === "type" || d.subcategory === "roll")
  );
  const friedItems = dishData.filter(
    (d) => d.category === "japanese" && d.subcategory === "fried"
  );
  const grilledItems = dishData.filter(
    (d) => d.category === "japanese" && d.subcategory === "grilled"
  );
  const simmeredItems = dishData.filter(
    (d) => d.category === "japanese" && d.subcategory === "simmered"
  );
  const noodleItems = dishData.filter(
    (d) => d.category === "japanese" && d.subcategory === "noodle"
  );
  const donburiItems = dishData.filter(
    (d) => d.category === "japanese" && d.subcategory === "donburi"
  );
  const appetizerItems = dishData.filter((d) => d.category === "appetizer");
  const soupItems = dishData.filter((d) => d.category === "soup");
  const dessertItems = dishData.filter((d) => d.category === "dessert");
  const drinkItems = dishData.filter((d) => d.category === "drink");
  const hotpotItems = dishData.filter(
    (d) => d.category === "japanese" && d.subcategory === "hotpot"
  );
  const riceItems = dishData.filter((d) => d.category === "rice");

  // レストラン別のフィルタリング
  let itemsToUse = [];

  if (restaurantId === "rest001") {
    // 和食レストラン: 全カテゴリーを含む
    itemsToUse = [
      ...appetizerItems.slice(0, 10),
      ...sashimiItems.slice(0, 12),
      ...sushiTypes.slice(0, 6),
      ...grilledItems.slice(0, 8),
      ...friedItems.slice(0, 6),
      ...simmeredItems,
      ...noodleItems.slice(0, 6),
      ...riceItems.slice(0, 6),
      ...hotpotItems.slice(0, 4),
      ...soupItems,
      ...dessertItems.slice(0, 8),
      ...drinkItems.slice(0, 15),
    ];
  } else if (restaurantId === "rest002") {
    // 居酒屋: 全カテゴリーを含む
    itemsToUse = [
      ...appetizerItems.slice(0, 12),
      ...sashimiItems.slice(0, 8),
      ...sushiTypes.slice(0, 4),
      ...grilledItems,
      ...friedItems,
      ...simmeredItems.slice(0, 4),
      ...noodleItems.slice(0, 4),
      ...riceItems.slice(0, 4),
      ...hotpotItems,
      ...soupItems.slice(0, 3),
      ...dessertItems.slice(0, 4),
      ...drinkItems,
    ];
  } else if (restaurantId === "rest003") {
    // 寿司処: 全カテゴリーを含む
    itemsToUse = [
      ...appetizerItems.slice(0, 6),
      ...sashimiItems.slice(0, 15),
      ...sushiTypes,
      ...grilledItems.slice(0, 4),
      ...friedItems.slice(0, 3),
      ...simmeredItems.slice(0, 3),
      ...noodleItems.slice(0, 3),
      ...riceItems.slice(0, 4),
      ...hotpotItems.slice(0, 2),
      ...soupItems.slice(0, 3),
      ...dessertItems.slice(0, 5),
      ...drinkItems.slice(0, 10),
    ];
  } else if (restaurantId === "rest004") {
    // カフェ: 全カテゴリーを含む
    itemsToUse = [
      ...appetizerItems.slice(0, 8),
      ...sashimiItems.slice(0, 4),
      ...sushiTypes.slice(0, 3),
      ...grilledItems.slice(0, 4),
      ...friedItems.slice(0, 4),
      ...simmeredItems.slice(0, 3),
      ...noodleItems,
      ...donburiItems,
      ...hotpotItems.slice(0, 2),
      ...soupItems.slice(0, 3),
      ...dessertItems,
      ...drinkItems,
    ];
  }

  // カテゴリIDのマッピング
  const categoryMapping = {
    appetizer: "cat_appetizer",
    sushi_fish: "cat_sashimi",
    sushi_type: "cat_sushi",
    sushi_roll: "cat_sushi",
    japanese_fried: "cat_fried",
    japanese_grilled: "cat_grilled",
    japanese_simmered: "cat_simmered",
    japanese_noodle: "cat_noodle",
    japanese_donburi: "cat_rice",
    japanese_hotpot: "cat_hotpot",
    rice: "cat_rice",
    soup: "cat_soup",
    dessert: "cat_dessert",
    drink: "cat_drink",
  };

  itemsToUse.forEach((item, idx) => {
    const categoryKey =
      item.category === "sushi"
        ? `${item.category}_${item.subcategory}`
        : item.category === "japanese"
          ? `${item.category}_${item.subcategory}`
          : item.category;

    const categoryId = categoryMapping[categoryKey] || "cat_appetizer";

    // 価格設定
    let basePrice = 800;
    if (categoryId === "cat_sashimi") basePrice = 1200;
    else if (categoryId === "cat_sushi") basePrice = 900;
    else if (categoryId === "cat_hotpot") basePrice = 2500;
    else if (categoryId === "cat_drink")
      basePrice = item.subcategory === "alcohol" ? 600 : 350;
    else if (categoryId === "cat_dessert") basePrice = 500;

    const price = Math.round((basePrice + idx * 50) / 50) * 50;

    menuItems.push({
      id: `item${String(order).padStart(4, "0")}`,
      category_id: categoryId,
      name_ja: item.term_ja,
      name_en: item.term_en,
      name_zh: item.term_zh,
      description_ja: `${item.term_ja}です`,
      description_en: `Delicious ${item.term_en}`,
      description_zh: `美味的${item.term_zh}`,
      price: price,
      image_url: getPlaceholderImage(item.term_ja),
      allergens: mapAllergens(item.subcategory, item.term_ja),
      tags: [],
      is_available: true,
      is_popular: idx < 3,
      spicy_level: 0,
      cooking_time:
        categoryId === "cat_sashimi" || categoryId === "cat_sushi"
          ? 5
          : categoryId === "cat_fried"
            ? 15
            : categoryId === "cat_grilled"
              ? 20
              : categoryId === "cat_simmered"
                ? 25
                : categoryId === "cat_hotpot"
                  ? 30
                  : categoryId === "cat_noodle" || categoryId === "cat_rice"
                    ? 10
                    : 5,
      order: order++,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return menuItems;
}

/**
 * DeepL API のみ（辞書なし）の翻訳をシミュレート
 * 辞書ありの翻訳は日本語の食文化用語をそのまま保持（例: Edamame）
 * 辞書なしの翻訳はDeepLが直訳するパターンをシミュレート（例: Green Soybeans）
 */
const nodicReplacements_en = {
  // 料理名: 辞書あり → 辞書なし（DeepL直訳）
  Edamame: "Green Soybeans",
  "Sashimi Platter": "Assorted Raw Fish Slices",
  "Assorted Sashimi": "Mixed Raw Fish Platter",
  "Salmon Sashimi": "Raw Salmon Slices",
  "Tuna Sashimi": "Raw Tuna Slices",
  "Medium Fatty Tuna Sashimi": "Medium Toro Raw Slices",
  "Otoro Fatty Tuna Sashimi": "Fatty Tuna Belly Raw Slices",
  "Flounder Sashimi": "Raw Flounder Slices",
  "Squid Sashimi": "Raw Squid Slices",
  "Sea Urchin": "Sea Urchin Roe",
  "Greater Amberjack Sashimi": "Raw Amberjack Slices",
  "Horse Mackerel Sashimi": "Raw Horse Mackerel Slices",
  "Vinegar-cured Mackerel": "Pickled Mackerel",
  "Nigiri Sushi Platter": "Hand-pressed Sushi Set",
  "Shrimp Nigiri (2 pcs)": "Hand-pressed Shrimp Sushi (2 pcs)",
  "Sea Urchin Nigiri (2 pcs)": "Hand-pressed Sea Urchin Sushi (2 pcs)",
  "Salmon Roe Gunkan (2 pcs)": "Battleship Salmon Roe Sushi (2 pcs)",
  "Conger Eel Nigiri (2 pcs)": "Hand-pressed Conger Eel Sushi (2 pcs)",
  "Hand Roll Set (3 pcs)": "Cone-shaped Sushi Roll Set (3 pcs)",
  "California Roll": "Inside-out Avocado Crab Roll",
  "Gyoza Dumplings": "Pan-fried Dumplings",
  "Agedashi Tofu": "Deep-fried Tofu in Broth",
  Takoyaki: "Octopus Balls",
  "Chicken Karaage": "Japanese-style Fried Chicken",
  Tonkatsu: "Breaded Deep-fried Pork Cutlet",
  "Ebi Fry": "Deep-fried Breaded Shrimp",
  Korokke: "Japanese-style Croquette",
  Tempura: "Battered Deep-fried Seafood & Vegetables",
  "Vegetable Tempura": "Battered Deep-fried Vegetables",
  Yakitori: "Grilled Chicken on Skewers",
  "Grilled Mackerel": "Salt-grilled Mackerel",
  "Grilled Salmon Belly": "Grilled Salmon Belly Portion",
  "Beef Tongue": "Grilled Sliced Beef Tongue",
  "Pork Belly Skewers": "Grilled Pork Belly on Skewers",
  Nikujaga: "Japanese Meat and Potato Stew",
  "Saba Misoni": "Mackerel Simmered in Miso",
  Kakuni: "Braised Pork Belly",
  Chawanmushi: "Steamed Egg Custard with Fillings",
  "Udon Noodles": "Thick Wheat Noodles in Broth",
  "Soba Noodles": "Buckwheat Noodles",
  Ramen: "Japanese Noodle Soup",
  "Yaki Udon": "Stir-fried Thick Noodles",
  Yakisoba: "Stir-fried Noodles with Sauce",
  "Katsu Curry": "Breaded Pork Cutlet with Curry",
  "Beef Bowl": "Sliced Beef over Rice",
  Oyakodon: "Chicken and Egg over Rice",
  Katsudon: "Breaded Pork Cutlet over Rice",
  Tendon: "Battered Shrimp over Rice",
  "Onigiri Set": "Rice Ball Set",
  Sukiyaki: "Japanese Beef Hot Pot",
  "Shabu-shabu": "Japanese Boiled Meat Hot Pot",
  "Kimchi Nabe": "Kimchi-flavored Hot Pot",
  "Chanko Nabe": "Sumo Wrestler Hot Pot",
  "Miso Soup": "Soybean Paste Soup",
  Tonjiru: "Pork and Vegetable Miso Soup",
  "Matcha Ice Cream": "Green Tea Flavored Ice Cream",
  "Daifuku Mochi": "Sweet Rice Cake with Bean Paste",
  Dango: "Sweet Rice Dumplings on Skewer",
  "Sake (Hot/Cold)": "Japanese Rice Wine (Hot/Cold)",
  "Shochu Highball": "Distilled Spirit Highball",
  "Matcha Highball": "Green Tea Highball",
  "Plum Wine Soda": "Plum Liqueur with Soda",
  "Yuzu Sour": "Citrus Sour Cocktail",
  "Calpis Sour": "Yogurt Drink Sour Cocktail",
  "Mentaiko Pasta": "Spicy Cod Roe Pasta",
  "Napolitan Spaghetti": "Japanese Ketchup Spaghetti",
  "Blend Coffee (Hot/Iced)": "Drip Coffee (Hot/Iced)",
  "Matcha Latte (Hot/Iced)": "Green Tea Latte (Hot/Iced)",
};

const nodicReplacements_zh = {
  // 料理名: 辞書あり → 辞書なし（DeepL直訳）
  毛豆: "盐水绿豆",
  什锦刺身拼盘: "各种生鱼片拼盘",
  综合刺身: "混合生鱼片",
  三文鱼刺身: "生三文鱼切片",
  金枪鱼刺身: "生金枪鱼切片",
  中腩金枪鱼刺身: "中等肥度金枪鱼生切片",
  大腩金枪鱼刺身: "最肥金枪鱼腹部生切片",
  比目鱼刺身: "生比目鱼切片",
  鱿鱼刺身: "生鱿鱼切片",
  海胆: "海胆卵",
  间八刺身: "生琥珀鱼切片",
  竹荚鱼刺身: "生竹荚鱼切片",
  醋腌青花鱼: "醋渍鲭鱼",
  握寿司拼盘: "手握寿司套装",
  "虾握寿司（2贯）": "手握虾寿司（2个）",
  "海胆握寿司（2贯）": "手握海胆寿司（2个）",
  "鱼子军舰寿司（2贯）": "军舰式鱼子寿司（2个）",
  "星鳗握寿司（2贯）": "手握星鳗寿司（2个）",
  "手卷寿司套餐（3根）": "锥形寿司卷套餐（3个）",
  加州卷: "反卷牛油果蟹肉寿司",
  煎饺: "平底锅煎饺子",
  炸豆腐: "油炸豆腐浇汁",
  章鱼烧: "章鱼丸子",
  日式炸鸡: "日本风格炸鸡块",
  炸猪排: "裹面包糠炸猪排",
  炸虾: "裹面包糠炸虾",
  可乐饼: "日式土豆饼",
  天妇罗: "裹面糊炸海鲜和蔬菜",
  蔬菜天妇罗: "裹面糊炸蔬菜",
  烤鸡串: "竹签烤鸡肉",
  盐烤鲭鱼: "盐烤青花鱼",
  烤三文鱼腩: "烤三文鱼腹部",
  烤牛舌: "烤切片牛舌",
  烤五花肉串: "竹签烤猪五花",
  肉末炖土豆: "日式肉和土豆炖菜",
  味噌炖鲭鱼: "味噌酱炖鲭鱼",
  红烧五花肉: "炖煮猪五花肉",
  茶碗蒸: "蒸蛋羹配料",
  乌冬面: "粗小麦面汤",
  荞麦面: "荞麦制面条",
  拉面: "日本面条汤",
  炒乌冬: "炒粗面条",
  炒面: "酱汁炒面条",
  炸猪排咖喱: "裹面包糠猪排配咖喱",
  牛肉盖饭: "切片牛肉盖饭",
  亲子丼: "鸡肉鸡蛋盖饭",
  炸猪排盖饭: "裹面包糠猪排盖饭",
  天妇罗盖饭: "裹面糊炸虾盖饭",
  饭团套餐: "米饭团子套餐",
  寿喜烧: "日式牛肉火锅",
  涮涮锅: "日式涮肉火锅",
  泡菜锅: "泡菜味火锅",
  相扑锅: "相扑力士火锅",
  味噌汤: "大豆酱汤",
  豚汁: "猪肉蔬菜味噌汤",
  抹茶冰淇淋: "绿茶味冰淇淋",
  大福: "甜糯米团配豆沙",
  团子: "甜糯米团子串",
  "日本清酒（冷/热）": "日本米酒（冷/热）",
  烧酒嗨棒: "蒸馏酒嗨棒",
  抹茶嗨棒: "绿茶嗨棒",
  梅酒苏打: "梅子酒加苏打水",
  柚子苏打酒: "柑橘苏打酒",
  可尔必思苏打酒: "酸奶饮料苏打酒",
  明太子意面: "辣鳕鱼子意大利面",
  日式番茄意面: "日本番茄酱意大利面",
  "综合咖啡（热/冰）": "滴滤咖啡（热/冰）",
  "抹茶拿铁（热/冰）": "绿茶牛奶拿铁（热/冰）",
};

/**
 * 辞書なし翻訳をシミュレート（DeepL APIの直訳パターン）
 */
function generateNodicName(originalName, lang) {
  const replacements =
    lang === "en" ? nodicReplacements_en : nodicReplacements_zh;
  return replacements[originalName] || originalName;
}

/**
 * メニューアイテムCSVを読み込んでデータを生成
 */
function loadMenuItemsFromCSV(menuData, restaurantId) {
  const menuItems = [];

  const config = restaurantConfig[restaurantId] || restaurantConfig["rest001"];
  let order = 1;

  menuData.forEach((item) => {
    // レストランに適したカテゴリかチェック
    if (!config.categories.includes(item.category_id)) {
      return;
    }

    // アレルゲンをパース（パイプ区切り）
    const allergens = item.allergens
      ? item.allergens.split("|").filter((a) => a.trim())
      : [];

    // タグをパース（カンマ区切り）
    const tags = item.tags ? item.tags.split(",").filter((t) => t.trim()) : [];

    menuItems.push({
      id: `item${String(order).padStart(4, "0")}`,
      category_id: item.category_id,
      name_ja: item.name_ja,
      name_en: item.name_en,
      name_zh: item.name_zh,
      name_en_nodic: generateNodicName(item.name_en, "en"),
      name_zh_nodic: generateNodicName(item.name_zh, "zh"),
      description_ja: item.description_ja,
      description_en: item.description_en,
      description_zh: item.description_zh,
      description_en_nodic: item.description_en,
      description_zh_nodic: item.description_zh,
      price: parseInt(item.price, 10),
      image_url: getPlaceholderImage(item.name_ja),
      allergens: allergens,
      tags: tags,
      is_available: true,
      is_popular: item.is_popular === "true",
      spicy_level: parseInt(item.spicy_level, 10) || 0,
      cooking_time: parseInt(item.cooking_time, 10) || 10,
      order: order,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    order++;
  });

  return menuItems;
}

/**
 * データを投入
 */
async function seedData() {
  try {
    console.log("🌱 データ投入を開始します（サブコレクション形式）...\n");

    // CSVファイルの読み込み
    console.log("📄 CSVファイルを読み込み中...");
    const menuItemsData = await readCSV(
      path.join(__dirname, "..", "menu_items.csv")
    );
    const dishData = await readCSV(
      path.join(__dirname, "..", "料理データ.csv")
    );
    console.log(`  ✓ メニューアイテム: ${menuItemsData.length}件`);
    console.log(`  ✓ 辞書データ: ${dishData.length}件\n`);

    // 新形式のメニューCSVがあるか確認
    const useNewFormat = menuItemsData.length > 0;
    if (useNewFormat) {
      console.log("📋 新形式のメニューCSVを使用します\n");
    } else {
      console.log("📋 旧形式の辞書データからメニューを生成します\n");
    }

    let totalTables = 0;
    let totalCategories = 0;
    let totalMenuItems = 0;

    // レストランごとにデータを投入
    for (const restaurant of restaurantsData) {
      console.log(
        `\n📍 ${restaurant.name} (${restaurant.id}) のデータを投入中...`
      );

      // レストラン本体を作成
      await db.collection("restaurants").doc(restaurant.id).set(restaurant);
      console.log(`  ✓ レストラン情報を投入`);

      // テーブルをサブコレクションとして投入
      const tableCount = restaurant.id === "rest001" ? 6 : 4;
      const tables = generateTablesData(restaurant.id, tableCount);

      for (const table of tables) {
        await db
          .collection("restaurants")
          .doc(restaurant.id)
          .collection("tables")
          .doc(table.id)
          .set(table);
      }
      console.log(`  ✓ テーブル: ${tables.length}件`);
      totalTables += tables.length;

      // カテゴリをサブコレクションとして投入（レストランに関連するカテゴリのみ）
      const config =
        restaurantConfig[restaurant.id] || restaurantConfig["rest001"];
      const restaurantCategories = categoriesTemplate.filter((cat) =>
        config.categories.includes(cat.id)
      );

      for (const category of restaurantCategories) {
        const categoryData = {
          ...category,
          is_available: true,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        };
        delete categoryData.id;

        await db
          .collection("restaurants")
          .doc(restaurant.id)
          .collection("menu_categories")
          .doc(category.id)
          .set(categoryData);
      }
      console.log(`  ✓ カテゴリ: ${restaurantCategories.length}件`);
      totalCategories += restaurantCategories.length;

      // メニューアイテムをサブコレクションとして投入
      const menuItems = useNewFormat
        ? loadMenuItemsFromCSV(menuItemsData, restaurant.id)
        : generateActualMenuItems(dishData, restaurant.id);

      // バッチ処理で効率化
      const batchSize = 500;
      for (let i = 0; i < menuItems.length; i += batchSize) {
        const batch = db.batch();
        const batchItems = menuItems.slice(i, i + batchSize);

        batchItems.forEach((item) => {
          const itemId = item.id;
          delete item.id;

          const docRef = db
            .collection("restaurants")
            .doc(restaurant.id)
            .collection("menu_items")
            .doc(itemId);
          batch.set(docRef, item);
        });

        await batch.commit();
      }
      console.log(`  ✓ メニューアイテム: ${menuItems.length}件`);
      totalMenuItems += menuItems.length;
    }

    console.log("\n✅ データ投入が完了しました！");
    console.log(`\n📊 投入されたデータ:`);
    console.log(`  - レストラン: ${restaurantsData.length}件`);
    console.log(`  - テーブル: ${totalTables}件`);
    console.log(`  - カテゴリ: ${totalCategories}件`);
    console.log(`  - メニューアイテム: ${totalMenuItems}件`);

    console.log(`\n🔗 アクセスURL例:`);
    restaurantsData.forEach((r) => {
      console.log(`  ${r.name}: your-app://restaurant/${r.id}/table/table001`);
    });
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  }
}

/**
 * データをクリア（サブコレクション対応）
 */
async function clearData() {
  try {
    console.log("🗑️  既存データをクリア中...\n");

    // レストランとそのサブコレクションを削除
    const restaurantsSnapshot = await db.collection("restaurants").get();

    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurantId = restaurantDoc.id;
      console.log(`  レストラン ${restaurantId} のデータを削除中...`);

      // サブコレクションを削除
      const subcollections = ["menu_categories", "menu_items", "tables"];

      for (const subcollection of subcollections) {
        const snapshot = await db
          .collection("restaurants")
          .doc(restaurantId)
          .collection(subcollection)
          .get();

        const batchSize = 500;
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
          const batch = db.batch();
          const batchDocs = snapshot.docs.slice(i, i + batchSize);

          batchDocs.forEach((doc) => {
            batch.delete(doc.ref);
          });

          await batch.commit();
        }

        console.log(`    ✓ ${subcollection}: ${snapshot.size}件削除`);
      }

      // レストラン本体を削除
      await restaurantDoc.ref.delete();
    }

    // 旧形式のコレクションも削除（存在する場合）
    const oldCollections = ["categories", "menu_items", "tables", "orders"];
    for (const collectionName of oldCollections) {
      const snapshot = await db.collection(collectionName).get();

      if (snapshot.size > 0) {
        const batchSize = 500;
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
          const batch = db.batch();
          const batchDocs = snapshot.docs.slice(i, i + batchSize);

          batchDocs.forEach((doc) => {
            batch.delete(doc.ref);
          });

          await batch.commit();
        }

        console.log(`  ✓ ${collectionName}（旧形式）: ${snapshot.size}件削除`);
      }
    }

    console.log("\n✅ データクリアが完了しました！\n");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  }
}

// コマンドライン引数の処理
const args = process.argv.slice(2);

if (args.includes("--clear")) {
  clearData()
    .then(() => {
      if (!args.includes("--clear-only")) {
        return seedData();
      }
    })
    .then(() => {
      process.exit(0);
    });
} else {
  seedData().then(() => {
    process.exit(0);
  });
}
