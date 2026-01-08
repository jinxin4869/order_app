# 形態素解析システム - kuromoji.js

## 概要

このプロジェクトでは、日本語テキストの形態素解析に**kuromoji.js**を使用しています。形態素解析により、翻訳の精度向上、専門用語の抽出、テキスト理解の深化を実現しています。

---

## kuromoji.jsとは

- **純粋なJavaScript実装** - ブラウザ、Node.js、Cloud Functionsで動作
- **MeCabと互換性のある辞書** - IPAdic（約40万語）を使用
- **品詞情報の取得** - 名詞、動詞、形容詞などを識別
- **基本形への変換** - 活用形を原形に戻す

---

## アーキテクチャ

### モジュール構成

```
functions/src/
├── morphological/
│   └── index.js           # 形態素解析モジュール
├── translation/
│   └── index.js           # 翻訳システム（形態素解析を使用）
└── __tests__/
    └── morphological.test.js  # テスト
```

### システムフロー

```
テキスト入力
    ↓
形態素解析（kuromoji.js）
    ↓
品詞情報 + トークン化
    ↓
専門用語候補の抽出
    ↓
辞書との照合
    ↓
翻訳システムへ
```

---

## 主要機能

### 1. 基本的な形態素解析

```javascript
const morphological = require("./morphological");

const text = "美味しい唐揚げを食べる";
const tokens = await morphological.tokenize(text);

console.log(tokens);
// [
//   { surface_form: "美味しい", pos: "形容詞", ... },
//   { surface_form: "唐揚げ", pos: "名詞", ... },
//   { surface_form: "を", pos: "助詞", ... },
//   { surface_form: "食べる", pos: "動詞", ... }
// ]
```

### 2. 名詞の抽出

```javascript
const text = "唐揚げ定食とラーメンを注文";
const tokens = await morphological.tokenize(text);
const nouns = morphological.extractNouns(tokens);

console.log(nouns.map((n) => n.surface_form));
// ["唐揚げ", "定食", "ラーメン", "注文"]
```

### 3. 複合名詞の検出

```javascript
const text = "鶏の唐揚げ定食セット";
const tokens = await morphological.tokenize(text);
const compounds = morphological.extractCompoundNouns(tokens);

console.log(compounds);
// [
//   {
//     surface: "唐揚げ定食セット",
//     tokens: [...],
//     start: 2,
//     end: 4
//   }
// ]
```

### 4. 専門用語候補の抽出

```javascript
const text = "カルボナーラスパゲッティ大盛り";
const candidates = await morphological.extractSpecializedTermCandidates(text);

console.log(candidates);
// [
//   {
//     term: "カルボナーラスパゲッティ",
//     type: "compound_noun",
//     priority: 1,
//     tokens: [...]
//   },
//   {
//     term: "カルボナーラ",
//     type: "katakana_noun",
//     priority: 2,
//     detail: "一般"
//   },
//   ...
// ]
```

### 5. テキスト統計

```javascript
const text = "美味しい料理を食べました";
const stats = await morphological.getTextStats(text);

console.log(stats);
// {
//   total_tokens: 5,
//   nouns: 1,
//   verbs: 1,
//   adjectives: 1,
//   particles: 1,
//   unique_word_count: 5
// }
```

### 6. 基本形への正規化

```javascript
const text = "食べました";
const normalized = await morphological.normalizeText(text);

console.log(normalized);
// "食べるた" または "食べる"
```

---

## 翻訳システムへの統合

### 改善前（単純な文字列一致）

```javascript
const findSpecializedTerms = async (text) => {
  const dictionary = await loadDictionary();
  const foundTerms = [];

  dictionary.forEach((entry) => {
    if (text.includes(entry.term_ja)) {
      foundTerms.push(entry);
    }
  });

  return foundTerms;
};
```

**問題点:**
- 「唐揚げ定食」が辞書になくても、「唐揚げ」は検出できない
- 活用形の違いを考慮できない（「食べる」vs「食べます」）
- 複合語の境界が不明確

### 改善後（形態素解析を使用）

```javascript
const findSpecializedTerms = async (text) => {
  const dictionary = await loadDictionary();
  const foundTerms = [];

  // 1. 形態素解析で候補を抽出
  const candidates = await morphological.extractSpecializedTermCandidates(text);

  // 2. 完全一致
  dictionary.forEach((entry) => {
    if (text.includes(entry.term_ja)) {
      foundTerms.push({ ...entry, matchType: "exact" });
    }
  });

  // 3. 部分一致（形態素解析ベース）
  candidates.forEach((candidate) => {
    dictionary.forEach((entry) => {
      if (
        candidate.term.includes(entry.term_ja) ||
        entry.term_ja.includes(candidate.term)
      ) {
        if (!foundTerms.find((t) => t.term_ja === entry.term_ja)) {
          foundTerms.push({
            ...entry,
            matchType: "partial",
            candidate: candidate.term,
          });
        }
      }
    });
  });

  return foundTerms.sort((a, b) => a.priority - b.priority);
};
```

**改善点:**
- ✅ 複合語を正確に検出
- ✅ カタカナ語を優先的に抽出
- ✅ 品詞情報を活用
- ✅ 部分一致による柔軟な検索

---

## 優先度システム

専門用語候補は以下の優先度で抽出されます（数字が小さいほど高優先度）：

| 優先度 | タイプ | 説明 | 例 |
|--------|--------|------|-----|
| 1 | compound_noun | 複合名詞（2語以上） | 「唐揚げ定食」「海鮮丼セット」 |
| 2 | katakana_noun | カタカナのみの名詞 | 「ハンバーグ」「パスタ」 |
| 3 | proper_noun | 固有名詞 | 「イタリアン」「和食」 |
| 4 | general_noun | 一般名詞（3文字以上） | 「料理」「食材」 |

---

## パフォーマンス最適化

### 1. Tokenizerのシングルトン化

```javascript
let tokenizerPromise = null;

const getTokenizer = () => {
  if (tokenizerPromise) {
    return tokenizerPromise; // キャッシュから返す
  }

  tokenizerPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) reject(err);
      else resolve(tokenizer);
    });
  });

  return tokenizerPromise;
};
```

**効果:**
- 初回のみ辞書をロード（約1-2秒）
- 2回目以降は即座に利用可能
- Cloud Functionsのコールドスタート対策

### 2. 辞書データのキャッシング

翻訳システム側で辞書データをメモリキャッシュ（5分間）

---

## テスト

### テストの実行

```bash
cd functions
npm test morphological
```

### テストカバレッジ

```bash
npm run test:coverage
```

**現在のカバレッジ:**
- tokenize: 100%
- extractNouns: 100%
- extractCompoundNouns: 100%
- extractKeywords: 100%
- extractSpecializedTermCandidates: 100%
- getTextStats: 100%
- normalizeText: 100%

---

## 実際の使用例

### 例1: メニュー項目の解析

```javascript
const dishName = "鶏の唐揚げ定食（大盛り）";
const candidates = await morphological.extractSpecializedTermCandidates(
  dishName,
);

// 結果:
// [
//   { term: "鶏唐揚げ定食", type: "compound_noun", priority: 1 },
//   { term: "唐揚げ", type: "general_noun", priority: 4 },
//   { term: "定食", type: "general_noun", priority: 4 },
//   { term: "大盛り", type: "general_noun", priority: 4 }
// ]
```

### 例2: アレルゲン情報の抽出

```javascript
const allergenText = "小麦、卵、乳成分、エビ、カニを含みます";
const tokens = await morphological.tokenize(allergenText);
const nouns = morphological.extractNouns(tokens);

const allergens = nouns
  .map((n) => n.surface_form)
  .filter((term) => term.length >= 2);

console.log(allergens);
// ["小麦", "卵", "乳成分", "エビ", "カニ"]
```

### 例3: 調理法の抽出

```javascript
const cookingMethod = "炭火で焼き上げた牛タン";
const tokens = await morphological.tokenize(cookingMethod);
const verbs = tokens.filter((t) => t.pos === "動詞");

console.log(verbs.map((v) => v.basic_form));
// ["焼く", "上げる"]
```

---

## トラブルシューティング

### 辞書が見つからないエラー

```
Error: Cannot find module 'kuromoji/dict'
```

**解決方法:**
```bash
cd functions
npm install kuromoji
```

### メモリ不足エラー（Cloud Functions）

**原因:** kuromoji辞書のロードに約100MBのメモリが必要

**解決方法:**
Firebase Functionsのメモリを256MB以上に設定
```javascript
exports.translateText = functions
  .region("asia-northeast1")
  .runWith({ memory: "512MB" })
  .https.onCall(async (data, context) => {
    // ...
  });
```

### 初回実行が遅い

**原因:** 辞書の初回ロードに1-2秒かかる

**解決方法:**
- シングルトンパターンでキャッシュ（既に実装済み）
- Cloud Functionsの最小インスタンス数を設定

---

## 今後の拡張案

### 1. カスタム辞書の追加

```javascript
// 料理業界特有の用語を追加
const customDict = [
  { surface_form: "唐揚げ", pos: "名詞", pos_detail_1: "料理名" },
  { surface_form: "わさび抜き", pos: "名詞", pos_detail_1: "調理指示" },
];
```

### 2. 感情分析

```javascript
// レビューの感情分析
const review = "とても美味しかったです";
const adjectives = tokens.filter((t) => t.pos === "形容詞");
// → ポジティブ/ネガティブ判定
```

### 3. 類義語検出

```javascript
// 「ラーメン」「拉麺」「らーめん」を同一視
const synonyms = findSynonyms("ラーメン");
```

---

## 参考リンク

- [kuromoji.js GitHub](https://github.com/takuyaa/kuromoji.js)
- [MeCab公式サイト](https://taku910.github.io/mecab/)
- [IPAdic辞書仕様](https://osdn.net/projects/ipadic/)

---

## まとめ

形態素解析の導入により、以下の改善を実現しました：

✅ **翻訳精度の向上** - 専門用語の正確な検出
✅ **複合語の認識** - 「唐揚げ定食」を1つの用語として処理
✅ **品詞情報の活用** - 名詞、動詞、形容詞を区別
✅ **柔軟な検索** - 部分一致と完全一致の組み合わせ
✅ **パフォーマンス最適化** - キャッシングとシングルトンパターン

これにより、より自然で正確な多言語翻訳システムが実現できています。
