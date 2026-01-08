# データ管理・統合システム

## 概要

このプロジェクトでは、料理データと料理法データを統合し、効率的な辞書システムを構築するためのデータ管理機能を提供しています。

- **CSVファイルの統合**: 複数のCSVファイルを読み込み、統一フォーマットに変換
- **重複排除**: 同一用語の重複を自動検出・削除
- **Firestore形式への変換**: データベース格納に適した形式に自動変換
- **類義語検出**: 表記揺れや類義語を自動検出

---

## データソース

### 1. 料理データ.csv

寿司ネタやメニュー項目の専門用語を格納

**フォーマット:**
```csv
id,term_ja,reading,term_en,term_zh,category,subcategory,priority,notes
sushi_001,マグロ,まぐろ,Tuna,金枪鱼,sushi,akami,1,赤身
```

**フィールド:**
- `id`: 一意の識別子
- `term_ja`: 日本語の用語
- `reading`: 読み仮名
- `term_en`: 英語翻訳
- `term_zh`: 中国語翻訳
- `category`: カテゴリ（sushi, dish, etc.）
- `subcategory`: サブカテゴリ
- `priority`: 優先度（1-999、低いほど高優先度）
- `notes`: 備考

### 2. 料理法.csv

調理法、料理タイプ、コース情報を格納

**フォーマット:**
```csv
Japanese,English,Chinese_simplified,Category
炙り焼き,seared/grilled,炙烤,cooking_method
```

**フィールド:**
- `Japanese`: 日本語の用語
- `English`: 英語翻訳
- `Chinese_simplified`: 中国語翻訳（簡体字）
- `Category`: カテゴリ（cooking_method, dish_type, course_category, course_order）

---

## データ統合ユーティリティ

### 基本的な使用方法

```javascript
const consolidator = require("./utils/data-consolidator");

// データを統合してJSON出力
const result = await consolidator.consolidate({
  dishDataPath: "./料理データ.csv",
  cookingMethodPath: "./料理法.csv",
  outputPath: "./consolidated_dictionary.json",
});

console.log(`統合完了: ${result.totalItems}件`);
```

### 出力フォーマット（Firestore形式）

```json
{
  "sushi_001": {
    "term_ja": "マグロ",
    "reading": "まぐろ",
    "translations": {
      "en": "Tuna",
      "zh": "金枪鱼"
    },
    "category": "sushi",
    "subcategory": "akami",
    "priority": 1,
    "type": "dish_name",
    "notes": "",
    "updated_at": "2025-01-08T10:00:00.000Z"
  }
}
```

---

## 主要機能

### 1. CSVファイルのパース

```javascript
const rows = await consolidator.parseCSV("./料理データ.csv");

console.log(rows);
// [
//   { id: "sushi_001", term_ja: "マグロ", ... },
//   { id: "sushi_002", term_ja: "サーモン", ... }
// ]
```

**特徴:**
- 引用符で囲まれたカンマを正しく処理
- 空行を自動スキップ
- ヘッダー行を自動検出

### 2. データ形式の変換

#### 料理データの変換

```javascript
const dishData = consolidator.convertDishData(rows);

// 変換結果:
// {
//   id: "sushi_001",
//   term_ja: "マグロ",
//   reading: "まぐろ",
//   term_en: "Tuna",
//   term_zh: "金枪鱼",
//   category: "sushi",
//   subcategory: "akami",
//   priority: 1,
//   notes: "",
//   type: "dish_name"  // 自動付与
// }
```

#### 料理法データの変換

```javascript
const cookingMethodData = consolidator.convertCookingMethodData(rows);

// 変換結果:
// {
//   id: "method_1",
//   term_ja: "炙り焼き",
//   reading: "",
//   term_en: "seared/grilled",
//   term_zh: "炙烤",
//   category: "cooking_method",
//   subcategory: "",
//   priority: 100,  // カテゴリに基づく自動割り当て
//   notes: "",
//   type: "cooking_method"
// }
```

### 3. データの統合と重複排除

```javascript
const consolidated = consolidator.consolidateData(dishData, cookingMethodData);

// 重複した用語（term_ja）は最初の出現のみ保持
// 優先度順にソート済み
```

**重複処理のルール:**
- `term_ja` をキーに重複を検出
- 最初に出現したエントリを保持（通常は優先度が高い方）
- 重複したエントリは破棄

### 4. Firestore形式への変換

```javascript
const firestoreData = consolidator.toFirestoreFormat(consolidated);

// 出力: { [docId]: { term_ja, translations, ... } }
```

**変換内容:**
- `id` をFirestoreドキュメントIDとして使用
- `term_en`, `term_zh` を `translations` オブジェクトに統合
- `updated_at` タイムスタンプを自動追加

---

## カテゴリと優先度

### カテゴリマッピング

| カテゴリ | 優先度 | タイプ | 説明 |
|---------|--------|--------|------|
| cooking_method | 100 | cooking_method | 調理法（炙り焼き、天ぷらなど） |
| dish_type | 200 | dish_type | 料理タイプ（定食、丼など） |
| course_category | 300 | course | コースカテゴリ（前菜、メインなど） |
| course_order | 400 | course | コース順序（1品目、2品目など） |

### 優先度の設定方針

- **1-99**: 最重要専門用語（寿司ネタ、人気メニューなど）
- **100-199**: 調理法
- **200-299**: 料理タイプ
- **300-399**: コース情報
- **400-999**: その他一般用語

---

## データの更新フロー

### 1. CSVファイルの更新

```bash
# 料理データ.csv または 料理法.csv を編集
vim 料理データ.csv
```

### 2. データの統合

```bash
cd functions
node -e "
  const consolidator = require('./src/utils/data-consolidator');
  consolidator.consolidate().then(result => {
    console.log('統合完了:', result.totalItems, '件');
  });
"
```

### 3. Firestoreへのインポート

```javascript
// functions/src/scripts/import-dictionary.js

const admin = require("firebase-admin");
const fs = require("fs");

admin.initializeApp();
const db = admin.firestore();

const data = JSON.parse(fs.readFileSync("./consolidated_dictionary.json"));

const batch = db.batch();
Object.entries(data).forEach(([docId, docData]) => {
  const ref = db.collection("dictionary").doc(docId);
  batch.set(ref, docData);
});

await batch.commit();
console.log("インポート完了");
```

---

## 統計情報の取得

統合処理後、以下の情報が得られます:

```javascript
const result = await consolidator.consolidate();

console.log(result);
// {
//   totalItems: 150,           // 統合後の総アイテム数
//   dishItems: 100,            // 料理データの件数
//   cookingMethodItems: 56,    // 料理法データの件数
//   outputPath: "./consolidated_dictionary.json",
//   data: [...]                // 統合されたデータ配列
// }
```

---

## エラー処理

### 一般的なエラー

**ファイルが見つからない:**
```
Error: ENOENT: no such file or directory
```
→ CSVファイルのパスを確認

**不正なCSVフォーマット:**
→ 引用符やカンマのエスケープを確認

**重複キーの警告:**
→ 最初の出現が保持されます（通常は意図通り）

---

## パフォーマンス最適化

### 大量データの処理

```javascript
// ストリーミング処理（メモリ効率）
const result = await consolidator.consolidate({
  dishDataPath: "./large_dish_data.csv",
  cookingMethodPath: "./large_cooking_data.csv",
});
```

**推奨事項:**
- 10,000行以下: 問題なし
- 10,000-50,000行: メモリ使用量に注意
- 50,000行以上: バッチ処理を検討

---

## ベストプラクティス

### 1. データの命名規則

```csv
# 良い例
id,term_ja,reading,term_en,term_zh,category,subcategory,priority,notes
sushi_001,マグロ,まぐろ,Tuna,金枪鱼,sushi,akami,1,

# 悪い例（IDがない、読み仮名がない）
,マグロ,,Tuna,金枪鱼,,,1,
```

### 2. 優先度の割り当て

```csv
# 人気メニューは低い数値（高優先度）
karaage_001,唐揚げ,からあげ,Karaage,日式炸鸡,dish,,1,人気メニュー

# 一般的な用語は高い数値（低優先度）
cooking_001,炒める,いためる,stir-fry,炒,cooking_method,,100,
```

### 3. カテゴリの統一

```csv
# 良い例（一貫したカテゴリ名）
category
sushi
sushi
dish

# 悪い例（表記揺れ）
category
Sushi
sushi
SUSHI
```

---

## トラブルシューティング

### CSVパースエラー

**問題:** カンマを含む用語が正しく解析されない

**解決方法:**
```csv
# 引用符で囲む
"Salmon, seared","サーモン炙り"
```

### 重複データの確認

```javascript
// 重複チェック用スクリプト
const consolidated = consolidator.consolidateData(dishData, cookingMethodData);
const termCounts = {};

consolidated.forEach((item) => {
  termCounts[item.term_ja] = (termCounts[item.term_ja] || 0) + 1;
});

Object.entries(termCounts).forEach(([term, count]) => {
  if (count > 1) {
    console.log(`重複: ${term} (${count}件)`);
  }
});
```

### メモリ不足エラー

**問題:** 大量データ処理時にメモリ不足

**解決方法:**
```bash
# Node.jsのメモリ上限を増やす
node --max-old-space-size=4096 script.js
```

---

## 参考リンク

- [CSVフォーマット仕様（RFC 4180）](https://www.ietf.org/rfc/rfc4180.txt)
- [Firestore データモデル](https://firebase.google.com/docs/firestore/data-model)
- [形態素解析システム](./morphological_analysis.md)
- [類義語検出システム](./synonym_detection.md)

---

## まとめ

データ統合ユーティリティにより、以下が実現できています:

✅ **複数CSVファイルの統合** - 料理データと料理法データを1つの辞書に統合
✅ **自動重複排除** - 同一用語の重複を検出・削除
✅ **Firestore形式への変換** - データベース格納に最適な形式
✅ **優先度ベースのソート** - 重要な用語を優先的に処理
✅ **拡張可能なアーキテクチャ** - 新しいデータソースを簡単に追加可能

これにより、効率的なデータ管理と高精度な翻訳システムが実現できています。
