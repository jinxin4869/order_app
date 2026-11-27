/**
 * Unsplash APIを使用してメニュー画像を更新するスクリプト
 *
 * 使用方法:
 * 1. .env ファイルに UNSPLASH_ACCESS_KEY を設定
 * 2. node scripts/data-tools/updateMenuImagesUnsplash.js
 *
 * 注意: Unsplash無料枠は50リクエスト/時間の制限あり
 */

const admin = require("firebase-admin");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

// Firebase Admin SDK の初期化
const serviceAccount = require("./credentials.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Unsplash API設定
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

if (!UNSPLASH_ACCESS_KEY) {
  console.error("❌ UNSPLASH_ACCESS_KEY が設定されていません");
  console.log("scripts/data-tools/.env ファイルに以下を追加してください:");
  console.log("UNSPLASH_ACCESS_KEY=your_access_key_here");
  process.exit(1);
}

// カテゴリ別の検索クエリ（フォールバック用）
const CATEGORY_QUERIES = {
  cat_appetizer: "japanese appetizer food",
  cat_sashimi: "sashimi japanese raw fish",
  cat_sushi: "sushi nigiri japanese",
  cat_grilled: "yakitori grilled japanese",
  cat_fried: "tempura japanese fried",
  cat_simmered: "japanese stew nimono",
  cat_noodle: "ramen udon japanese noodles",
  cat_rice: "donburi rice bowl japanese",
  cat_hotpot: "japanese hot pot nabe",
  cat_soup: "miso soup japanese",
  cat_dessert: "japanese dessert mochi matcha",
  cat_drink: "japanese sake tea drink",
  cat_pasta: "pasta spaghetti",
  cat_sandwich: "sandwich cafe",
  cat_salad: "salad fresh",
  cat_cafe_drink: "coffee latte cafe",
};

// 料理名から検索クエリを生成
const DISH_QUERIES = {
  枝豆: "edamame",
  刺身: "sashimi",
  サーモン: "salmon sashimi",
  まぐろ: "tuna sashimi",
  ウニ: "sea urchin uni",
  寿司: "sushi nigiri",
  握り: "nigiri sushi",
  いくら: "salmon roe ikura",
  餃子: "gyoza dumpling",
  豆腐: "tofu japanese",
  たこ焼き: "takoyaki",
  唐揚げ: "karaage fried chicken",
  とんかつ: "tonkatsu pork cutlet",
  エビフライ: "fried shrimp",
  天ぷら: "tempura",
  焼き鳥: "yakitori",
  サバ: "grilled mackerel",
  牛タン: "beef tongue",
  肉じゃが: "nikujaga",
  角煮: "braised pork belly",
  うどん: "udon noodles",
  そば: "soba noodles",
  ラーメン: "ramen",
  焼きそば: "yakisoba",
  カレー: "japanese curry",
  牛丼: "gyudon beef bowl",
  親子丼: "oyakodon",
  カツ丼: "katsudon",
  天丼: "tendon tempura",
  おにぎり: "onigiri rice ball",
  すき焼き: "sukiyaki",
  しゃぶしゃぶ: "shabu shabu",
  鍋: "japanese hot pot",
  味噌汁: "miso soup",
  豚汁: "pork miso soup",
  抹茶: "matcha green tea",
  アイス: "ice cream",
  大福: "daifuku mochi",
  団子: "dango",
  ケーキ: "cake dessert",
  パンケーキ: "pancakes",
  日本酒: "sake japanese",
  ビール: "beer",
  コーヒー: "coffee",
  ラテ: "latte",
  紅茶: "tea",
  パスタ: "pasta",
  サンド: "sandwich",
  サラダ: "salad",
};

/**
 * 料理名から最適な検索クエリを生成
 */
function getSearchQuery(dishName, categoryId) {
  // 料理名に含まれるキーワードをチェック
  for (const [keyword, query] of Object.entries(DISH_QUERIES)) {
    if (dishName.includes(keyword)) {
      return query;
    }
  }

  // カテゴリのデフォルトクエリを使用
  return CATEGORY_QUERIES[categoryId] || "japanese food";
}

/**
 * Unsplash APIで画像を検索
 */
async function searchUnsplashImage(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Unsplash API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (data.results && data.results.length > 0) {
    // small サイズの URL を返す（400x300程度）
    return data.results[0].urls.small;
  }

  return null;
}

/**
 * レート制限を考慮した遅延
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * メニューアイテムの画像URLを更新
 */
async function updateMenuImages() {
  try {
    console.log("🖼️  Unsplash APIを使用してメニュー画像を更新します...\n");
    console.log("⚠️  注意: 無料枠は50リクエスト/時間です\n");

    // 全レストランを取得
    const restaurantsSnapshot = await db.collection("restaurants").get();

    if (restaurantsSnapshot.empty) {
      console.log("⚠️  レストランが見つかりません");
      return;
    }

    let totalUpdated = 0;
    let totalErrors = 0;
    const imageCache = new Map(); // 同じクエリの画像をキャッシュ

    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurantId = restaurantDoc.id;
      const restaurantData = restaurantDoc.data();
      console.log(
        `\n📍 ${restaurantData.name || restaurantId} の画像を更新中...`
      );

      // メニューアイテムを取得
      const menuItemsSnapshot = await db
        .collection("restaurants")
        .doc(restaurantId)
        .collection("menu_items")
        .get();

      if (menuItemsSnapshot.empty) {
        console.log("  ⚠️  メニューアイテムがありません");
        continue;
      }

      for (const itemDoc of menuItemsSnapshot.docs) {
        const itemData = itemDoc.data();
        const dishName = itemData.name_ja || "";
        const categoryId = itemData.category_id || "";

        const query = getSearchQuery(dishName, categoryId);

        try {
          let imageUrl;

          // キャッシュをチェック
          if (imageCache.has(query)) {
            imageUrl = imageCache.get(query);
            console.log(`  📦 キャッシュ使用: ${dishName}`);
          } else {
            // API呼び出し
            imageUrl = await searchUnsplashImage(query);

            if (imageUrl) {
              imageCache.set(query, imageUrl);
              console.log(`  ✓ ${dishName} (${query})`);
            } else {
              console.log(`  ⚠️ 画像なし: ${dishName} (${query})`);
            }

            // レート制限対策: リクエスト間に遅延を入れる
            await delay(100);
          }

          if (imageUrl) {
            await itemDoc.ref.update({ image_url: imageUrl });
            totalUpdated++;
          }
        } catch (error) {
          console.error(`  ❌ エラー: ${dishName} - ${error.message}`);
          totalErrors++;

          // レート制限エラーの場合は待機
          if (error.message.includes("403") || error.message.includes("429")) {
            console.log("  ⏳ レート制限に達した可能性があります。60秒待機...");
            await delay(60000);
          }
        }
      }
    }

    console.log("\n✅ 画像URL更新が完了しました！");
    console.log(`📊 更新: ${totalUpdated}件, エラー: ${totalErrors}件`);
    console.log(`📦 キャッシュ使用: ${imageCache.size}種類のクエリ`);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  }
}

/**
 * ドライラン（APIを呼び出さずにクエリをプレビュー）
 */
async function dryRun() {
  try {
    console.log("🔍 ドライラン: 検索クエリのプレビュー\n");

    const restaurantsSnapshot = await db.collection("restaurants").get();

    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurantId = restaurantDoc.id;
      const restaurantData = restaurantDoc.data();
      console.log(`\n📍 ${restaurantData.name || restaurantId}`);
      console.log("─".repeat(50));

      const menuItemsSnapshot = await db
        .collection("restaurants")
        .doc(restaurantId)
        .collection("menu_items")
        .limit(10)
        .get();

      for (const itemDoc of menuItemsSnapshot.docs) {
        const itemData = itemDoc.data();
        const dishName = itemData.name_ja || "";
        const categoryId = itemData.category_id || "";
        const query = getSearchQuery(dishName, categoryId);

        console.log(`  ${dishName}`);
        console.log(`    検索クエリ: "${query}"`);
      }

      console.log(`  ... 他 ${menuItemsSnapshot.size < 10 ? 0 : "多数"} 件`);
    }
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  }
}

// コマンドライン引数の処理
const args = process.argv.slice(2);

if (args.includes("--dry-run") || args.includes("-d")) {
  dryRun().then(() => {
    console.log(
      "\n💡 実行するには: node scripts/data-tools/updateMenuImagesUnsplash.js"
    );
    process.exit(0);
  });
} else {
  updateMenuImages().then(() => {
    process.exit(0);
  });
}
