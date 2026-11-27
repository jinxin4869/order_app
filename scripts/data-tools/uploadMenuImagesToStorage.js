/**
 * メニュー画像を Firebase Storage にアップロードし、Firestore の image_url を更新するスクリプト
 *
 * 使用方法:
 *   node scripts/data-tools/uploadMenuImagesToStorage.js --dry-run   # プレビュー（実行なし）
 *   node scripts/data-tools/uploadMenuImagesToStorage.js              # アップロード＋Firestore更新
 *
 * 前提:
 *   1. Firebase Admin SDK の credentials.json を scripts/data-tools/ に配置
 *   2. Firebase Storage のルールをデプロイ済み: firebase deploy --only storage
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Firebase Admin SDK の初期化
const serviceAccount = require("./credentials.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const bucket = admin
  .storage()
  .bucket("qr-order-system-f1acb.firebasestorage.app");

// 定数
const IMAGES_DIR = path.join(__dirname, "..", "assets", "images", "menu");
const STORAGE_PREFIX = "menu_images";

/**
 * ファイル名（拡張子なし）→ name_ja マッピング
 * menu_items.csv の name_ja と一致させること
 */
const FILENAME_TO_NAME_JA = {
  // === appetizer (前菜) ===
  edamame: "枝豆",
  hiyayakko: "冷奴",
  agedashi_tofu: "揚げ出し豆腐",
  tako_wasabi: "たこわさび",
  dashimaki_tamago: "出し巻き玉子",
  chawanmushi: "茶碗蒸し",
  tsukemono: "漬物盛り合わせ",
  asari_butter: "あさりの酒蒸し",
  kinpira_gobo: "きんぴらごぼう",
  horenso_gomaae: "ほうれん草の胡麻和え",
  potato_salad: "ポテトサラダ",
  ebi_mayo: "エビマヨ",
  kimchi: "キムチ",
  moyashi_namul: "もやしのナムル",
  reishabu: "冷しゃぶ",
  niratama: "ニラ玉",
  nasu_agebitashi: "茄子の揚げ浸し",
  banbanji: "バンバンジー",
  shumai: "シュウマイ（4個）",

  // === sashimi (刺身) ===
  maguro_sashimi: "本マグロ刺身",
  buri_sashimi: "ハマチ刺身",
  tai_sashimi: "ヒラメ刺身",
  ika_sashimi: "イカ刺身",
  uni: "ウニ",
  katsuo_tataki: "カンパチ刺身",
  shime_saba: "しめ鯖",

  // === sushi (寿司) ===
  ebi_nigiri: "エビ握り（2貫）",
  uni_gunkan: "ウニ握り（2貫）",
  ikura_gunkan: "イクラ軍艦（2貫）",
  anago_nigiri: "穴子握り（2貫）",
  temaki: "手巻き寿司セット（3本）",
  california_roll: "カリフォルニアロール",
  inari_sushi: "いなり寿司（3個）",

  // === grilled (焼き物) ===
  yakitori_moriawase: "焼き鳥盛り合わせ（5本）",
  yakitori_tsukune: "つくね（2本）",
  saba_shioyaki: "サバの塩焼き",
  gyutan_shioyaki: "牛タン塩焼き",
  buta_shogayaki: "豚の生姜焼き",
  yaki_onigiri: "焼きおにぎり（2個）",
  yaki_nasu: "焼きナス",
  sake_hoil_yaki: "鮭のホイル焼き",

  // === fried (揚げ物) ===
  karaage: "唐揚げ",
  ebi_fry: "エビフライ（3尾）",
  tonkatsu: "とんかつ",
  tempura_moriawase: "天ぷら盛り合わせ",
  korokke: "コロッケ（2個）",
  kakiage: "かき揚げ",
  menchikatsu: "メンチカツ（2個）",
  gyoza: "餃子（6個）",
  takoyaki: "たこ焼き（8個）",
  subuta: "酢豚",

  // === simmered (煮物) ===
  nikujaga: "肉じゃが",

  // === noodle (麺類) ===
  yakisoba: "焼きそば",

  // === rice (ご飯・丼) ===
  omurice: "オムライス",
  ochazuke: "お茶漬け",
  takenoko_gohan: "たけのこご飯",
  mentaiko_gohan: "炊き込みご飯",

  // === hotpot (鍋物) ===
  sukiyaki: "すき焼き（1人前）",

  // === soup (汁物) ===
  tonjiru: "豚汁",
  zosui: "雑炊",

  // === dessert (デザート) ===
  matcha_ice: "抹茶アイス",
  vanilla_ice: "バニラアイス",
  warabi_mochi: "わらび餅",
  matcha_pudding: "抹茶プリン",
  fruit_moriawase: "フルーツ盛り合わせ",
  annin_tofu: "杏仁豆腐",
  daigakuimo: "大学芋",
  mitarashi_dango: "みたらし団子（3本）",
  cheesecake: "チーズケーキ",
  tiramisu: "ティラミス",
  brownie: "チョコレートブラウニー",
  creme_brulee: "クレームブリュレ",
  pancake: "パンケーキ",
  parfait: "パフェ",

  // === drink (飲み物) ===
  nama_beer: "生ビール（中）",
  nama_beer_large: "生ビール（大）",
  highball: "ハイボール",
  lemon_sour: "レモンサワー",
  matcha_highball: "抹茶ハイ",
  yuzu_sour: "ゆずサワー",
  ginger_ale: "ジンジャーエール",
  oolong_tea: "ウーロン茶",
  matcha_drink: "緑茶",
  berry_smoothie: "フルーツスムージー",

  // === salad (サラダ) ===
  caesar_salad: "シーザーサラダ",
  salmon_avocado_salad: "アボカドサーモンサラダ",
  tofu_salad: "豆腐と野菜のサラダ",
  prosciutto_salad: "生ハムとルッコラのサラダ",

  // === sandwich (サンドイッチ) ===
  sandwich: "BLTサンドイッチ",

  // === pasta (パスタ) ===
  napolitan: "ナポリタン",
  carbonara: "カルボナーラ",
  peperoncino: "ペペロンチーノ",
  meat_sauce: "ミートソースパスタ",
  mentaiko_pasta: "明太子パスタ",
  kinoko_pasta: "きのこクリームパスタ",

  // === cafe_drink (カフェドリンク) ===
  black_coffee: "ブレンドコーヒー（Hot/Ice）",
  cafe_latte: "カフェラテ（Hot/Ice）",
  cappuccino: "カプチーノ",
  matcha_latte: "抹茶ラテ（Hot/Ice）",
  hojicha: "紅茶（Hot/Ice）",
  hot_chocolate: "ホットチョコレート",
};

/**
 * assets/images/menu/ 配下の全画像ファイルを再帰的に取得
 */
function getAllImageFiles() {
  const imageFiles = [];

  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`❌ 画像ディレクトリが見つかりません: ${IMAGES_DIR}`);
    return imageFiles;
  }

  const categories = fs.readdirSync(IMAGES_DIR, { withFileTypes: true });

  for (const entry of categories) {
    if (!entry.isDirectory()) continue;

    const category = entry.name;
    const categoryDir = path.join(IMAGES_DIR, category);
    const files = fs.readdirSync(categoryDir);

    for (const file of files) {
      if (
        !file.endsWith(".png") &&
        !file.endsWith(".jpg") &&
        !file.endsWith(".jpeg")
      )
        continue;

      const basename = path.parse(file).name;
      imageFiles.push({
        localPath: path.join(categoryDir, file),
        category,
        filename: file,
        basename,
        storagePath: `${STORAGE_PREFIX}/${category}/${file}`,
      });
    }
  }

  return imageFiles;
}

/**
 * 画像を Firebase Storage にアップロードして公開URLを返す
 */
async function uploadImage(localPath, storagePath) {
  const contentType = localPath.endsWith(".png") ? "image/png" : "image/jpeg";

  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000",
    },
  });

  const file = bucket.file(storagePath);
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

/**
 * 全画像をアップロードし name_ja → URL マップを構築
 */
async function uploadAllImages(imageFiles) {
  const nameJaToUrl = new Map();
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const img = imageFiles[i];
    const nameJa = FILENAME_TO_NAME_JA[img.basename];

    if (!nameJa) {
      console.log(`  ⚠️  マッピングなし: ${img.category}/${img.filename}`);
      skipped++;
      continue;
    }

    try {
      const url = await uploadImage(img.localPath, img.storagePath);
      nameJaToUrl.set(nameJa, url);
      uploaded++;
      console.log(
        `  [${uploaded}/${imageFiles.length}] ✓ ${img.category}/${img.filename} → ${nameJa}`
      );
    } catch (err) {
      // リトライ1回
      try {
        await new Promise((r) => setTimeout(r, 2000));
        const url = await uploadImage(img.localPath, img.storagePath);
        nameJaToUrl.set(nameJa, url);
        uploaded++;
        console.log(
          `  [${uploaded}/${imageFiles.length}] ✓ ${img.category}/${img.filename} → ${nameJa} (リトライ成功)`
        );
      } catch (retryErr) {
        console.error(
          `  ❌ アップロード失敗: ${img.category}/${img.filename} - ${retryErr.message}`
        );
        errors++;
      }
    }
  }

  return { nameJaToUrl, uploaded, skipped, errors };
}

/**
 * Firestore の menu_items の image_url を更新
 */
async function updateFirestoreMenuItems(nameJaToUrl) {
  const restaurantsSnapshot = await db.collection("restaurants").get();
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const restaurantDoc of restaurantsSnapshot.docs) {
    const restaurantId = restaurantDoc.id;
    const restaurantData = restaurantDoc.data();
    console.log(
      `\n📍 ${restaurantData.name || restaurantId} の image_url を更新中...`
    );

    const menuItemsSnapshot = await db
      .collection("restaurants")
      .doc(restaurantId)
      .collection("menu_items")
      .get();

    if (menuItemsSnapshot.empty) {
      console.log("  ⚠️  メニューアイテムがありません");
      continue;
    }

    const batchSize = 500;
    const items = menuItemsSnapshot.docs;
    let restaurantUpdated = 0;
    let restaurantSkipped = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = db.batch();
      const batchItems = items.slice(i, i + batchSize);

      for (const itemDoc of batchItems) {
        const itemData = itemDoc.data();
        const nameJa = itemData.name_ja || "";
        const newUrl = nameJaToUrl.get(nameJa);

        if (newUrl) {
          batch.update(itemDoc.ref, { image_url: newUrl });
          restaurantUpdated++;
        } else {
          restaurantSkipped++;
        }
      }

      await batch.commit();
    }

    console.log(
      `  ✓ 更新: ${restaurantUpdated}件 / スキップ: ${restaurantSkipped}件`
    );
    totalUpdated += restaurantUpdated;
    totalSkipped += restaurantSkipped;
  }

  return { totalUpdated, totalSkipped };
}

/**
 * メイン処理: アップロード＋Firestore更新
 */
async function uploadAndUpdate() {
  try {
    console.log(
      "🖼️  メニュー画像の Firebase Storage アップロードを開始します...\n"
    );

    // 1. 画像ファイル一覧を取得
    const imageFiles = getAllImageFiles();
    console.log(`📁 ${imageFiles.length}件の画像ファイルを検出\n`);

    if (imageFiles.length === 0) {
      console.log("⚠️  画像ファイルが見つかりません");
      return;
    }

    // 2. Storage にアップロード
    console.log("☁️  Firebase Storage にアップロード中...\n");
    const { nameJaToUrl, uploaded, skipped, errors } =
      await uploadAllImages(imageFiles);

    console.log(
      `\n📊 アップロード結果: 成功 ${uploaded}件 / スキップ ${skipped}件 / エラー ${errors}件`
    );

    if (nameJaToUrl.size === 0) {
      console.log(
        "⚠️  アップロードされた画像がないため、Firestore更新をスキップします"
      );
      return;
    }

    // 3. Firestore を更新
    console.log("\n🔄 Firestore の image_url を更新中...");
    const { totalUpdated, totalSkipped } =
      await updateFirestoreMenuItems(nameJaToUrl);

    console.log("\n✅ 完了！");
    console.log(
      `📊 Firestore更新結果: 更新 ${totalUpdated}件 / スキップ ${totalSkipped}件`
    );
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  }
}

/**
 * ドライラン: アップロードせずマッピング結果をプレビュー
 */
async function dryRun() {
  try {
    console.log("🔍 ドライラン: マッピングのプレビュー\n");

    // 1. 画像ファイル一覧
    const imageFiles = getAllImageFiles();
    console.log(`📁 ${imageFiles.length}件の画像ファイルを検出\n`);

    let mapped = 0;
    let unmapped = 0;
    const nameJaSet = new Set();

    console.log("── 画像 → メニュー名 マッピング ──\n");

    for (const img of imageFiles) {
      const nameJa = FILENAME_TO_NAME_JA[img.basename];
      if (nameJa) {
        console.log(`  ✓ ${img.category}/${img.filename} → ${nameJa}`);
        nameJaSet.add(nameJa);
        mapped++;
      } else {
        console.log(`  ✗ ${img.category}/${img.filename} → (マッピングなし)`);
        unmapped++;
      }
    }

    console.log(
      `\n📊 画像マッピング: 対応あり ${mapped}件 / 対応なし ${unmapped}件`
    );

    // 2. Firestore 側の確認
    console.log("\n── Firestore メニューアイテムとの照合 ──\n");

    const restaurantsSnapshot = await db.collection("restaurants").get();
    let totalMatched = 0;
    let totalUnmatched = 0;
    const unmatchedItems = [];

    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurantId = restaurantDoc.id;
      const restaurantData = restaurantDoc.data();
      console.log(`📍 ${restaurantData.name || restaurantId}`);

      const menuItemsSnapshot = await db
        .collection("restaurants")
        .doc(restaurantId)
        .collection("menu_items")
        .get();

      let matched = 0;
      let unmatched = 0;

      for (const itemDoc of menuItemsSnapshot.docs) {
        const itemData = itemDoc.data();
        if (nameJaSet.has(itemData.name_ja)) {
          matched++;
        } else {
          unmatched++;
          unmatchedItems.push(`  ${restaurantId}: ${itemData.name_ja}`);
        }
      }

      console.log(`  画像あり: ${matched}件 / 画像なし: ${unmatched}件`);
      totalMatched += matched;
      totalUnmatched += unmatched;
    }

    if (unmatchedItems.length > 0) {
      console.log("\n⚠️  画像が見つからないメニューアイテム:");
      // 重複を除去して表示
      const uniqueItems = [...new Set(unmatchedItems)];
      uniqueItems.forEach((item) => console.log(item));
    }

    console.log(
      `\n📊 合計: 画像対応 ${totalMatched}件 / 画像未対応 ${totalUnmatched}件`
    );
    console.log(
      "\n💡 実行するには: node scripts/data-tools/uploadMenuImagesToStorage.js"
    );
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  }
}

// コマンドライン引数の処理
const args = process.argv.slice(2);

if (args.includes("--dry-run") || args.includes("-d")) {
  dryRun().then(() => process.exit(0));
} else {
  uploadAndUpdate().then(() => process.exit(0));
}
