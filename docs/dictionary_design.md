# 専門用語辞書設計書

## 目的

本ドキュメントでは、翻訳精度向上のための専門用語辞書の設計と初期データを定義します。汎用翻訳APIでは対応が難しい飲食店特有の専門用語を多言語で管理し、高品質な翻訳を実現します。

---

## 1. 辞書の役割と重要性

### 1.1 なぜ専門用語辞書が必要か

| 課題 | 汎用翻訳APIの限界 | 辞書による解決 |
|------|----------------|-------------|
| **料理名の誤訳** | "炙りサーモン" → "Burning Salmon" | "Seared Salmon"（正確な訳） |
| **調理法の曖昧性** | "煮る" → "boil"（沸騰）or "simmer"（煮込み） | 文脈に応じた適切な訳 |
| **文化的背景** | "お通し" → "Small dish"（直訳） | "Appetizer (Otoshi)"（説明付き） |
| **アレルゲン** | "そば" → "Buckwheat"（食材）or "Soba"（料理） | 明確な区別 |

### 1.2 辞書の活用フロー

```
1. ユーザーが日本語メニューを選択
   ↓
2. 形態素解析（Kuromoji.js）で単語分割
   ↓
3. 専門用語辞書とマッチング
   ↓
4. ヒットした用語を翻訳APIに「コンテキスト」として付与
   ↓
5. 翻訳結果を辞書ベースで後処理・補正
   ↓
6. 高精度な翻訳テキストを表示
```

---

## 2. CSVフォーマット定義

### 2.1 ファイル仕様

- **ファイル名**: `translation_dictionary.csv`
- **文字コード**: UTF-8 with BOM
- **改行コード**: LF（\n）
- **区切り文字**: カンマ（,）
- **囲み文字**: ダブルクォート（"）

### 2.2 カラム定義

| カラム名 | データ型 | 必須 | 説明 | 例 |
|---------|---------|------|------|-----|
| id | string | ○ | 一意識別子（連番） | 1, 2, 3... |
| term_ja | string | ○ | 日本語用語 | 炙り |
| reading | string | × | 読み仮名（ひらがな） | あぶり |
| term_en | string | ○ | 英語訳 | seared |
| term_zh | string | ○ | 中国語訳（簡体字） | 炙烤 |
| category | string | ○ | カテゴリ | cooking_method |
| subcategory | string | × | サブカテゴリ | grilling |
| priority | number | ○ | 優先度（1=最高, 5=最低） | 2 |
| notes | string | × | 備考・使用例 | 表面を軽く焼く |

### 2.3 CSVヘッダー例

```csv
id,term_ja,reading,term_en,term_zh,category,subcategory,priority,notes
```

---

## 3. カテゴリ分類

### 3.1 主要カテゴリ一覧

| カテゴリID | カテゴリ名 | 英語表記 | 説明 | 優先度 |
|----------|----------|---------|------|-------|
| dish_name | 料理名 | Dish Name | 具体的な料理の名称 | 最高 |
| ingredient | 食材 | Ingredient | 材料・素材 | 高 |
| cooking_method | 調理法 | Cooking Method | 調理方法・技法 | 高 |
| allergen | アレルゲン | Allergen | アレルギー物質 | 最高 |
| taste | 味 | Taste | 味覚表現 | 中 |
| texture | 食感 | Texture | 食感表現 | 中 |
| serving_style | 提供スタイル | Serving Style | 提供方法 | 低 |
| utensil | 食器・調理器具 | Utensil | 道具類 | 低 |

### 3.2 サブカテゴリ例

#### cooking_method（調理法）
- grilling（焼く）
- boiling（茹でる・煮る）
- frying（揚げる）
- steaming（蒸す）
- raw（生）
- simmering（煮込む）

#### ingredient（食材）
- seafood（海鮮）
- meat（肉類）
- vegetable（野菜）
- grain（穀物）
- seasoning（調味料）

---

## 4. 優先度レベル定義

| 優先度 | レベル | 対象用語 | 処理方針 |
|-------|-------|---------|---------|
| 1 | 最高 | アレルゲン、主要料理名 | 必ず辞書訳を使用 |
| 2 | 高 | 調理法、重要食材 | 辞書訳を優先、APIで補完 |
| 3 | 中 | 一般食材、味表現 | 辞書とAPIを併用 |
| 4 | 低 | 提供スタイル、一般表現 | APIを優先、辞書で確認 |
| 5 | 最低 | 補助的な用語 | APIに任せる |

---

## 5. 初期辞書データ（50エントリ）

**エントリ数削減の理由**:
- 3ヶ月の開発期間を考慮し、100エントリ→50エントリに削減
- 研究の核心（形態素解析の有効性）は維持
- 高優先度の専門用語に集中（料理名、食材、調理法、アレルゲン）
- 評価実験で十分な翻訳精度差を示すには50エントリで十分

**削減後の構成**:
- 料理名: 30→15エントリ（優先度1-2の主要料理に絞る）
- 食材: 25→15エントリ（海鮮、肉類、アレルゲン食材を優先）
- 調理法: 20→10エントリ（基本的な調理法のみ）
- アレルゲン: 10→10エントリ（削減なし、重要度最高）

### 5.1 料理名（dish_name）- 15エントリ

```csv
id,term_ja,reading,term_en,term_zh,category,subcategory,priority,notes
1,寿司,すし,Sushi,寿司,dish_name,rice,1,シャリに魚介を乗せた料理
2,刺身,さしみ,Sashimi,生鱼片,dish_name,raw,1,生の魚介をスライスした料理
3,天ぷら,てんぷら,Tempura,天妇罗,dish_name,fried,1,衣をつけて揚げた料理
4,ラーメン,らーめん,Ramen,拉面,dish_name,noodle,1,中華風麺料理
5,うどん,うどん,Udon,乌冬面,dish_name,noodle,1,太い日本の麺
6,そば,そば,Soba,荞麦面,dish_name,noodle,1,そば粉を使った麺（アレルゲン注意）
7,焼き鳥,やきとり,Yakitori,烤鸡肉串,dish_name,grilled,2,鶏肉の串焼き
8,唐揚げ,からあげ,Karaage,炸鸡,dish_name,fried,2,鶏肉の揚げ物
9,とんかつ,とんかつ,Tonkatsu,炸猪排,dish_name,fried,2,豚肉のカツレツ
10,牛丼,ぎゅうどん,Gyudon,牛肉盖饭,dish_name,rice,2,牛肉の煮込みをご飯に乗せた丼
11,味噌汁,みそしる,Miso Soup,味噌汤,dish_name,soup,2,味噌ベースのスープ
12,炙りサーモン,あぶりさーもん,Seared Salmon,炙烤三文鱼,dish_name,grilled,2,表面を炙ったサーモン
13,大トロ,おおとろ,Fatty Tuna,金枪鱼大肥,dish_name,raw,1,マグロの最も脂の多い部位
14,海鮮丼,かいせんどん,Seafood Bowl,海鲜盖饭,dish_name,rice,2,刺身を乗せた丼
15,すき焼き,すきやき,Sukiyaki,寿喜烧,dish_name,hotpot,2,甘辛い牛肉の鍋料理
```

### 5.2 食材（ingredient）- 15エントリ

```csv
16,サーモン,さーもん,Salmon,三文鱼,ingredient,seafood,2,鮭
17,マグロ,まぐろ,Tuna,金枪鱼,ingredient,seafood,2,鮪
18,エビ,えび,Shrimp,虾,ingredient,seafood,1,アレルゲン
19,イカ,いか,Squid,鱿鱼,ingredient,seafood,2,烏賊
20,タコ,たこ,Octopus,章鱼,ingredient,seafood,2,蛸
21,カニ,かに,Crab,蟹,ingredient,seafood,1,アレルゲン
22,牛肉,ぎゅうにく,Beef,牛肉,ingredient,meat,2,
23,豚肉,ぶたにく,Pork,猪肉,ingredient,meat,2,
24,鶏肉,とりにく,Chicken,鸡肉,ingredient,meat,2,
25,卵,たまご,Egg,鸡蛋,ingredient,protein,1,アレルゲン
26,豆腐,とうふ,Tofu,豆腐,ingredient,protein,2,大豆製品
27,米,こめ,Rice,米,ingredient,grain,2,
28,小麦粉,こむぎこ,Wheat Flour,小麦粉,ingredient,grain,1,アレルゲン
29,醤油,しょうゆ,Soy Sauce,酱油,ingredient,seasoning,2,大豆・小麦含む
30,味噌,みそ,Miso,味噌,ingredient,seasoning,2,発酵大豆ペースト
```

### 5.3 調理法（cooking_method）- 10エントリ

```csv
31,焼く,やく,Grill,烤,cooking_method,grilling,2,
32,炙る,あぶる,Sear,炙烤,cooking_method,grilling,2,表面を軽く焼く
33,揚げる,あげる,Deep-fry,油炸,cooking_method,frying,2,
34,茹でる,ゆでる,Boil,煮,cooking_method,boiling,2,お湯で加熱
35,煮る,にる,Simmer,炖,cooking_method,simmering,2,じっくり煮込む
36,蒸す,むす,Steam,蒸,cooking_method,steaming,2,
37,炒める,いためる,Stir-fry,炒,cooking_method,frying,2,
38,生,なま,Raw,生,cooking_method,raw,1,加熱していない
39,照り焼き,てりやき,Teriyaki Glaze,照烧,cooking_method,grilling,2,甘辛いタレで焼く
40,唐揚げ,からあげ,Deep-fried,炸,cooking_method,frying,2,粉をまぶして揚げる
```

### 5.4 アレルゲン（allergen）- 10エントリ

```csv
41,小麦,こむぎ,Wheat,小麦,allergen,grain,1,7大アレルゲン
42,卵,たまご,Egg,鸡蛋,allergen,protein,1,7大アレルゲン
43,乳,にゅう,Milk,牛奶,allergen,dairy,1,7大アレルゲン
44,そば,そば,Buckwheat,荞麦,allergen,grain,1,7大アレルゲン
45,ピーナッツ,ぴーなっつ,Peanut,花生,allergen,nut,1,7大アレルゲン
46,エビ,えび,Shrimp,虾,allergen,seafood,1,7大アレルゲン
47,カニ,かに,Crab,蟹,allergen,seafood,1,7大アレルゲン
48,大豆,だいず,Soybean,大豆,allergen,legume,1,推奨表示品目
49,ゴマ,ごま,Sesame,芝麻,allergen,seed,1,推奨表示品目
50,魚,さかな,Fish,鱼,allergen,seafood,1,推奨表示品目
```

**注記**: 味・食感・提供スタイルなどの低優先度カテゴリは、3ヶ月の開発期間を考慮し、初期辞書から除外しました。これらは将来の拡張フェーズで追加可能です。

---

## 6. 辞書メンテナンス方針

### 6.1 辞書の更新タイミング

| タイミング | 更新内容 | 頻度 |
|-----------|---------|------|
| **初期導入時** | 基本50エントリ登録 | 1回 |
| **メニュー追加時** | 新規料理名・食材の追加 | 随時 |
| **翻訳精度評価後** | 誤訳が多い用語の追加・修正 | 月1回 |
| **フィードバック反映** | 留学生評価実験後の改善 | 実験後 |

### 6.2 辞書の品質管理

#### 品質チェック項目
1. **一貫性**: 同じ用語に複数の訳がないか
2. **正確性**: ネイティブチェック済みか
3. **完全性**: 日本語・英語・中国語すべて入力されているか
4. **優先度**: 適切なカテゴリ・優先度が設定されているか

#### バージョン管理
- GitHubでCSVファイルをバージョン管理
- 変更履歴をコミットメッセージに記録
- 定期的にバックアップ（週次）

### 6.3 辞書拡張計画

| フェーズ | 目標エントリ数 | 対象カテゴリ |
|---------|-------------|------------|
| **Phase 1（11月）** | 50エントリ | 基本料理名・調理法・アレルゲン・主要食材 |
| **Phase 2（12月、オプション）** | 100エントリ | 味・食感・提供スタイルの追加 |
| **Phase 3（将来拡張）** | 150-200エントリ | フィードバック反映・マイナー用語追加 |

**注記**: 3ヶ月の開発期間を考慮し、Phase 1の50エントリで研究を進めます。Phase 2以降は時間に余裕があれば実施します。

---

## 7. 辞書データの活用方法

### 7.1 Firestoreへのインポート

#### インポートスクリプト（Node.js）
```javascript
// scripts/import_dictionary.js
const admin = require('firebase-admin');
const csv = require('csv-parser');
const fs = require('fs');

admin.initializeApp();
const db = admin.firestore();

const importDictionary = async () => {
  const results = [];

  fs.createReadStream('translation_dictionary.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      const batch = db.batch();

      results.forEach((row) => {
        const docRef = db.collection('dictionary').doc(row.id);
        batch.set(docRef, {
          term_ja: row.term_ja,
          reading: row.reading || null,
          term_en: row.term_en,
          term_zh: row.term_zh,
          category: row.category,
          subcategory: row.subcategory || null,
          priority: parseInt(row.priority),
          notes: row.notes || null,
          usage_count: 0,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`${results.length}件の辞書データをインポートしました`);
    });
};

importDictionary();
```

### 7.2 Cloud Functionsでの参照

```javascript
// functions/translate.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// 辞書検索（キャッシュ付き）
let dictionaryCache = null;

const loadDictionary = async () => {
  if (dictionaryCache) return dictionaryCache;

  const snapshot = await db.collection('dictionary')
    .orderBy('priority', 'asc')
    .get();

  dictionaryCache = snapshot.docs.map(doc => doc.data());
  return dictionaryCache;
};

// 用語マッチング
const findTerms = async (text) => {
  const dictionary = await loadDictionary();
  const foundTerms = [];

  dictionary.forEach(entry => {
    if (text.includes(entry.term_ja)) {
      foundTerms.push(entry);
    }
  });

  return foundTerms.sort((a, b) => a.priority - b.priority);
};
```

---

## 8. 評価・改善サイクル

### 8.1 辞書の効果測定

| 指標 | 測定方法 | 目標値 |
|------|---------|-------|
| **カバー率** | 辞書にヒットした用語の割合 | 60%以上（50エントリで） |
| **精度向上率** | Level 1（形態素解析）とLevel 2（シンプルマッチング）の比較 | 10-20%向上 |
| **使用頻度** | 各用語のusage_count | 上位20%で80%カバー |

### 8.2 改善プロセス

```
1. 翻訳ログの分析
   ↓
2. 未登録の頻出用語を抽出
   ↓
3. ネイティブチェック（留学生協力）
   ↓
4. CSVに追加・Firestoreに反映
   ↓
5. 翻訳精度の再評価
```

---

## 9. 参考資料

### 9.1 用語収集元

- [農林水産省 日本食品標準成分表](https://www.mext.go.jp/a_menu/syokuhinseibun/)
- [消費者庁 アレルギー表示制度](https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/)
- [日本料理アカデミー 英語メニュー](https://japanese-culinary-academy.org/)

### 9.2 翻訳品質確認

- Google Translate
- DeepL Translator

---

## 10. 次のステップ

1. **CSVファイルの作成**: 上記50エントリをベースにCSV作成
2. **Firestoreインポート**: スクリプト実行でデータベース登録
3. **フロントエンド実装**: Kuromoji.jsと辞書参照ロジックの実装
4. **翻訳精度テスト**: Level 1（形態素解析）とLevel 2（シンプルマッチング）の比較評価

詳細は [translation_system_design.md](./translation_system_design.md) を参照してください。

---

## 更新履歴

| 日付 | 更新内容 | 担当者 |
|------|---------|--------|
| 2024-11-19 | 初版作成（100エントリ定義） | - |
| 2024-11-19 | エントリ数を100→50に削減、構成を最適化 | - |
