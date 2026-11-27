# Firestore データ投入スクリプト（サブコレクション対応版）

このディレクトリには、Firestoreにサンプルデータを投入するためのスクリプトが含まれています。

> [!WARNING]
> これらのスクリプトは Admin SDK の秘密鍵（`credentials.json`）で、指定したプロジェクトの Firestore と Storage を直接書き換えます。`seedData.js --clear` は既存の店舗・メニュー・テーブルを削除します。実行前に接続先のプロジェクトを確認してください。ローカルのエミュレーターで試す場合は、ルートの `npm run test:demo`（`scripts/seed-demo.cjs`）を使います。

| スクリプト                     | 用途                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| `seedData.js`                  | CSV から店舗・カテゴリ・メニュー・テーブルを投入する              |
| `seedDictionary.js`            | 専門用語辞書を `dictionary` コレクションへ投入する                |
| `exportSurveyData.js`          | アンケート用に、辞書あり・なしの翻訳を JSON へ書き出す            |
| `uploadMenuImagesToStorage.js` | メニュー画像を Storage へ上げ、`image_url` を更新する             |
| `updateMenuImagesUnsplash.js`  | Unsplash の画像で `image_url` を更新する（`.env.example` を参照） |
| `fix_csv.py`                   | 引用符の壊れた CSV を修復する                                     |

英語・中国語の翻訳（辞書あり・なし）は、スクリプトではなくスタッフ画面のメニュー管理の「翻訳を更新」（`batchTranslateMenu`）で作ります。この方法だけが、画面が必要とする翻訳のメタデータ（`<field>_translation`）を保存します（[翻訳の生成・比較](../../docs/translation_contract.md)）。以前の `generateBothTranslations.js` はメタデータを保存しないため削除しました。

`exportSurveyData.js` は翻訳の本文だけを書き出し、メタデータは確認しません。「翻訳を更新」で作り直す前のデータを書き出すと、未検証の訳が混ざります。

## 🎯 新機能

- ✅ **サブコレクション形式**: Firebase Functionsに対応した階層構造
- ✅ **4つのレストラン**: 和食レストラン、居酒屋、寿司処、カフェ
- ✅ **レストラン別メニュー**: 各店舗に合わせた約50-70件のメニュー
- ✅ **プレースホルダー画像**: DiceBear APIを使用した一貫性のある画像
- ✅ **アレルゲン情報**: 料理名から自動判定
- ✅ **調理時間**: カテゴリごとに適切な時間を設定
- ✅ **QRコード対応**: 各テーブルにQRコードデータを設定

## セットアップ

### 1. Firebase Admin SDK の認証情報を取得

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 「プロジェクトの設定」→「サービス アカウント」
4. 「新しい秘密鍵の生成」をクリック
5. ダウンロードしたJSONファイルを `scripts/data-tools/credentials.json` として保存

### 2. 依存関係のインストール

```bash
cd scripts/data-tools
npm install
```

## 使用方法

### データの投入

CSVファイル（`料理データ.csv` と `料理法.csv`）からデータを読み込み、Firestoreに投入します。

```bash
cd scripts/data-tools
npm run seed
```

### 既存データをクリアしてから投入

```bash
npm run seed:clear
```

### 既存データのクリアのみ（投入しない）

```bash
npm run seed:clear-only
```

## データ構造（サブコレクション形式）

### ⚠️ 重要な変更点

以前のフラットな構造から、**サブコレクション形式**に変更されました。これにより、Firebase Functionsとの互換性が確保されています。

```
restaurants/{restaurantId}
  ├─ (レストラン情報)
  ├─ menu_categories/{categoryId}
  ├─ menu_items/{itemId}
  └─ tables/{tableId}
```

### レストラン一覧

1. **rest001**: 和食レストラン 桜（6テーブル、69件のメニュー）
2. **rest002**: 居酒屋 海風（4テーブル、69件のメニュー）
3. **rest003**: 寿司処 鮨一（4テーブル、49件のメニュー）
4. **rest004**: カフェ＆ダイニング HANA（4テーブル、67件のメニュー）

**合計: 254件のメニューアイテム**

### コレクション構造

#### 1. `restaurants/{restaurantId}`

レストラン本体（4件）

```javascript
{
  name: '和食レストラン 桜',
  name_en: 'Sakura Japanese Restaurant',
  name_zh: '樱花日本料理',
  description: '本格的な和食を提供する人気のレストラン',
  description_en: 'Authentic Japanese cuisine restaurant',
  description_zh: '提供正宗日本料理的人气餐厅',
  address: '東京都渋谷区桜丘町1-2-3',
  phone: '03-1234-5678',
  is_active: true,
  default_language: 'ja',
  supported_languages: ['ja', 'en', 'zh'],
  created_at: Timestamp
}
```

#### 2. `restaurants/{restaurantId}/tables/{tableId}`

テーブル情報（サブコレクション）

```javascript
{
  table_number: '1',
  capacity: 4,
  status: 'available',
  qr_code: 'rest001/table001',
  created_at: Timestamp
}
```

#### 3. `restaurants/{restaurantId}/menu_categories/{categoryId}`

メニューカテゴリ（サブコレクション）

カテゴリ一覧:

- 前菜 🥗
- 刺身 🍣
- 寿司 🍱
- 焼き物 🍖
- 揚げ物 🍤
- 煮物 🍲
- 麺類 🍜
- ご飯・丼 🍚
- 鍋物 🥘
- 汁物 🥣
- デザート 🍰
- 飲み物 🍺

```javascript
{
  name_ja: '刺身',
  name_en: 'Sashimi',
  name_zh: '生鱼片',
  icon: '🍣',
  order: 2,
  is_available: true,
  created_at: Timestamp
}
```

#### 4. `restaurants/{restaurantId}/menu_items/{itemId}`

メニューアイテム（サブコレクション）

特徴:

- CSVデータから実際の料理メニューを生成
- レストランごとに異なるメニュー構成
- プレースホルダー画像付き（DiceBear API）
- アレルゲン情報を自動判定
- 調理時間を設定

```javascript
{
  category_id: 'cat_sashimi',
  name_ja: 'マグロ',
  name_en: 'Tuna',
  name_zh: '金枪鱼',
  description_ja: 'マグロです',
  description_en: 'Delicious Tuna',
  description_zh: '美味的金枪鱼',
  price: 1200,
  image_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=...',
  allergens: ['fish'],
  tags: [],
  is_available: true,
  is_popular: true,
  spicy_level: 0,
  cooking_time: 5,
  order: 1,
  created_at: Timestamp
}
```

## CSVファイル

### 料理データ.csv

- 290件の料理用語データ
- カテゴリ: sushi, japanese, appetizer, soup, rice, drink, dessert
- サブカテゴリ: fish, seafood, fried, grilled, simmered, noodle, donburi など
- 多言語対応（日本語、英語、中国語）

### 料理法.csv

- 56件の調理法データ
- カテゴリ: cooking_method, dish_type, course_category, course_order
- 例: 炙り焼き、煮付け、天ぷら、照り焼き など
- 将来の拡張用（現在は読み込みのみ）

## アクセスURL例

データ投入後、以下のようなURLでアクセスできます：

### 和食レストラン 桜

```
your-app://restaurant/rest001/table/rest001_table001
your-app://restaurant/rest001/table/rest001_table002
```

### 居酒屋 海風

```
your-app://restaurant/rest002/table/rest002_table001
your-app://restaurant/rest002/table/rest002_table002
```

### 寿司処 鮨一

```
your-app://restaurant/rest003/table/rest003_table001
```

### カフェ＆ダイニング HANA

```
your-app://restaurant/rest004/table/rest004_table001
```

## トラブルシューティング

### CSVファイルの修正

もしCSVファイルに問題がある場合は、修正スクリプトを実行してください:

```bash
cd scripts/data-tools
python3 fix_csv.py
```

このスクリプトは、CSVファイルの不正なクォート処理を修正します。

### エラー: `Cannot find module 'csv-parser'`

```bash
cd scripts/data-tools
npm install
```

### エラー: `Cannot find module './credentials.json'`

Firebase Admin SDK の認証情報ファイルが配置されていません。上記の「セットアップ」セクションを参照してください。

### エラー: `Permission denied`

Firebase プロジェクトの権限設定を確認してください。サービスアカウントに Firestore の読み書き権限が必要です。
