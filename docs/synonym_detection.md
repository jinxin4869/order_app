# 類義語検出システム

## 概要

日本語の表記揺れや類義語を自動検出し、統一した用語に変換するシステムです。翻訳精度の向上と、ユーザー入力の柔軟な処理を実現します。

**主要機能:**
- カタカナ・ひらがなの相互変換（ラーメン ↔ らーめん）
- 長音記号の正規化（ラ━メン → ラーメン）
- 編集距離ベースの類似度計算
- 辞書との照合による類義語検出
- 類義語グループの自動生成

---

## アーキテクチャ

### モジュール構成

```
functions/src/
├── morphological/
│   ├── index.js          # 形態素解析
│   └── synonyms.js       # 類義語検出（新規）
├── translation/
│   └── index.js          # 翻訳システム（類義語統合済み）
└── __tests__/
    └── synonyms.test.js  # テスト
```

### システムフロー

```
テキスト入力
    ↓
形態素解析（専門用語候補を抽出）
    ↓
正規化（表記揺れを統一）
    ↓
類義語検出（辞書との照合）
    ↓
マッチング結果を翻訳システムへ
```

---

## 主要機能

### 1. テキストの正規化

```javascript
const synonyms = require("./morphological/synonyms");

const text = "　ＡＢＣ　ラ━メン　";
const normalized = synonyms.normalizeText(text);

console.log(normalized);
// "abcラーメン"
```

**正規化処理:**
1. 全角英数字 → 半角英数字（ＡＢＣ → ABC）
2. 長音記号の統一（━、ｰ → ー）
3. 空白の削除
4. 英数字の小文字化

### 2. カタカナ・ひらがな変換

```javascript
// カタカナ → ひらがな
const hiragana = synonyms.katakanaToHiragana("ラーメン");
console.log(hiragana); // "らーめん"

// ひらがな → カタカナ
const katakana = synonyms.hiraganaToKatakana("らーめん");
console.log(katakana); // "ラーメン"
```

**用途:**
- 表記揺れの吸収（メニューの「らーめん」と辞書の「ラーメン」を同一視）
- ユーザー入力の柔軟な処理

### 3. 類義語判定

```javascript
const result = synonyms.areSynonyms("ラーメン", "らーめん");

console.log(result);
// {
//   isSynonym: true,
//   confidence: 0.95,
//   matchType: "kana_variant"
// }
```

**マッチタイプ:**
- `exact`: 正規化後の完全一致（信頼度 1.0）
- `kana_variant`: カタカナ・ひらがな変換後の一致（信頼度 0.95）
- `partial`: 部分一致（信頼度は包含率による）
- `similar`: 編集距離ベースの類似（信頼度は類似度による）
- `none`: 類義語ではない

### 4. 辞書から類義語を検索

```javascript
const dictionary = [
  {term_ja: "ラーメン", term_en: "Ramen", priority: 1},
  {term_ja: "らーめん", term_en: "Ramen", priority: 2},
  {term_ja: "拉麺", term_en: "Ramen", priority: 3},
  {term_ja: "寿司", term_en: "Sushi", priority: 1},
];

const results = synonyms.findSynonyms("らーめん", dictionary, {
  maxResults: 10,
  minConfidence: 0.75,
});

console.log(results);
// [
//   { term_ja: "ラーメン", confidence: 0.95, matchType: "kana_variant", ... },
//   { term_ja: "らーめん", confidence: 1.0, matchType: "exact", ... }
// ]
```

**オプション:**
- `maxResults`: 最大結果数（デフォルト: 10）
- `minConfidence`: 最小信頼度（デフォルト: 0.7）
- `strictMode`: 完全一致のみ（デフォルト: false）
- `allowPartialMatch`: 部分一致を許可（デフォルト: true）

### 5. テキスト内の類義語を一括検出

```javascript
const text = "美味しいラーメンと唐揚げ定食を注文";

const results = await synonyms.detectSynonymsInText(text, dictionary, {
  minConfidence: 0.75,
});

console.log(results);
// [
//   {
//     term_ja: "ラーメン",
//     confidence: 1.0,
//     matchType: "exact",
//     candidateInfo: { term: "ラーメン", type: "katakana_noun", priority: 2 }
//   },
//   {
//     term_ja: "唐揚げ",
//     confidence: 0.95,
//     matchType: "partial",
//     candidateInfo: { term: "唐揚げ定食", type: "compound_noun", priority: 1 }
//   }
// ]
```

**処理フロー:**
1. 形態素解析で専門用語候補を抽出
2. 各候補について辞書から類義語を検索
3. 信頼度順にソート
4. 重複を削除

### 6. 類義語グループの生成

```javascript
const terms = ["ラーメン", "らーめん", "ラ━メン", "寿司", "すし"];

const groups = synonyms.createSynonymGroups(terms, {
  minConfidence: 0.8,
});

console.log(groups);
// [
//   {
//     canonical: "ラーメン",
//     variants: ["ラーメン", "らーめん", "ラ━メン"],
//     count: 3
//   },
//   {
//     canonical: "寿司",
//     variants: ["寿司", "すし"],
//     count: 2
//   }
// ]
```

**用途:**
- データのクリーニング
- 統計分析
- 辞書の整理

---

## 類似度計算

### Levenshtein距離

2つの文字列間の編集距離を計算します。

```javascript
const distance = synonyms.levenshteinDistance("ラーメン", "ラーメソ");
console.log(distance); // 1（1文字置換）
```

**編集距離の定義:**
- 置換: 1文字を別の文字に変更（例: "ン" → "ソ"）
- 挿入: 1文字を追加（例: "test" → "tests"）
- 削除: 1文字を削除（例: "tests" → "test"）

### 類似度スコア

```javascript
const similarity = synonyms.calculateSimilarity("ラーメン", "ラーメソ");
console.log(similarity); // 0.75（4文字中3文字一致）
```

**計算式:**
```
類似度 = (長い方の文字列長 - 編集距離) / 長い方の文字列長
```

**例:**
- "test" vs "test": 1.0（完全一致）
- "test" vs "best": 0.75（1文字違い）
- "test" vs "west": 0.5（2文字違い）

---

## 翻訳システムへの統合

### 改善前（類義語検出なし）

```javascript
const findSpecializedTerms = async (text) => {
  const dictionary = await loadDictionary();
  const foundTerms = [];

  // 完全一致のみ
  dictionary.forEach((entry) => {
    if (text.includes(entry.term_ja)) {
      foundTerms.push(entry);
    }
  });

  return foundTerms;
};
```

**問題点:**
- 「らーめん」が辞書の「ラーメン」にマッチしない
- 長音記号の違い（ラ━メン）を認識できない
- 部分一致のみで類似語を見逃す

### 改善後（類義語検出あり）

```javascript
const findSpecializedTerms = async (text) => {
  const dictionary = await loadDictionary();
  const foundTerms = [];
  const seenTerms = new Set();

  // 1. 形態素解析
  const candidates = await morphological.extractSpecializedTermCandidates(text);

  // 2. 完全一致
  dictionary.forEach((entry) => {
    if (text.includes(entry.term_ja)) {
      foundTerms.push({...entry, matchType: "exact"});
      seenTerms.add(entry.term_ja);
    }
  });

  // 3. 部分一致
  candidates.forEach((candidate) => {
    dictionary.forEach((entry) => {
      if (seenTerms.has(entry.term_ja)) return;

      if (candidate.term.includes(entry.term_ja) ||
          entry.term_ja.includes(candidate.term)) {
        foundTerms.push({...entry, matchType: "partial"});
        seenTerms.add(entry.term_ja);
      }
    });
  });

  // 4. 類義語検出（新規）
  candidates.forEach((candidate) => {
    const synonymMatches = synonyms.findSynonyms(candidate.term, dictionary, {
      maxResults: 5,
      minConfidence: 0.75,
    });

    synonymMatches.forEach((match) => {
      if (seenTerms.has(match.matchedTerm)) return;

      foundTerms.push({
        ...match,
        matchType: `synonym_${match.matchType}`,
      });
      seenTerms.add(match.matchedTerm);
    });
  });

  return foundTerms.sort((a, b) => a.priority - b.priority);
};
```

**改善点:**
✅ カタカナ・ひらがなの表記揺れを吸収
✅ 長音記号の違いを正規化
✅ 編集距離ベースで類似語を検出
✅ 重複を自動排除
✅ 信頼度順にソート

---

## 実際の使用例

### 例1: メニュー検索

```javascript
const menuText = "らーめんと餃子のセット";
const dictionary = await loadDictionary();

const results = await synonyms.detectSynonymsInText(menuText, dictionary);

// 結果:
// - "ラーメン" (confidence: 0.95, matchType: "kana_variant")
// - "餃子" (confidence: 1.0, matchType: "exact")
// - "セット" (confidence: 1.0, matchType: "exact")
```

### 例2: ユーザー入力の処理

```javascript
const userInput = "カラアゲ"; // 表記揺れ
const dictionary = [
  {term_ja: "唐揚げ", term_en: "Karaage", priority: 1},
];

const matches = synonyms.findSynonyms(userInput, dictionary, {
  minConfidence: 0.7,
});

if (matches.length > 0) {
  console.log(`"${userInput}" は "${matches[0].term_ja}" として認識されました`);
  // "カラアゲ" は "唐揚げ" として認識されました
}
```

### 例3: データクリーニング

```javascript
const rawTerms = [
  "ラーメン", "らーめん", "ラ━メン",
  "寿司", "すし",
  "唐揚げ", "からあげ", "カラアゲ",
];

const groups = synonyms.createSynonymGroups(rawTerms, {
  minConfidence: 0.75,
});

groups.forEach((group) => {
  console.log(`代表形: ${group.canonical}`);
  console.log(`バリエーション: ${group.variants.join(", ")}`);
});

// 代表形: ラーメン
// バリエーション: ラーメン, らーめん, ラ━メン
//
// 代表形: 寿司
// バリエーション: 寿司, すし
//
// 代表形: 唐揚げ
// バリエーション: 唐揚げ, からあげ, カラアゲ
```

---

## パフォーマンス最適化

### 1. 信頼度の閾値調整

```javascript
// 高精度モード（厳格）
const results = synonyms.findSynonyms(term, dictionary, {
  minConfidence: 0.9, // 信頼度90%以上のみ
});

// 高再現率モード（緩和）
const results = synonyms.findSynonyms(term, dictionary, {
  minConfidence: 0.6, // 信頼度60%以上も含む
});
```

**推奨設定:**
- 専門用語検索: 0.75-0.85（バランス）
- ユーザー入力補正: 0.6-0.7（緩め）
- 辞書整理: 0.85-0.95（厳格）

### 2. 結果数の制限

```javascript
// 上位5件のみ取得
const results = synonyms.findSynonyms(term, dictionary, {
  maxResults: 5,
});
```

### 3. 厳密モードの活用

```javascript
// 完全一致のみ（高速）
const result = synonyms.areSynonyms(term1, term2, {
  strictMode: true,
});
```

---

## 設定オプション

### areSynonyms のオプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| strictMode | false | 完全一致のみを類義語とする |
| allowPartialMatch | true | 部分一致を許可 |
| minSimilarity | 0.7 | 類似度の最小閾値（0.0-1.0） |

### findSynonyms のオプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| maxResults | 10 | 最大結果数 |
| minConfidence | 0.7 | 最小信頼度（0.0-1.0） |

### detectSynonymsInText のオプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| minConfidence | 0.7 | 最小信頼度 |
| maxResults | 10 | 各候補あたりの最大結果数 |

---

## トラブルシューティング

### 類義語が検出されない

**原因:** 信頼度の閾値が高すぎる

**解決方法:**
```javascript
// minConfidenceを下げる
const results = synonyms.findSynonyms(term, dictionary, {
  minConfidence: 0.6, // デフォルトの0.7から下げる
});
```

### 誤った類義語が検出される

**原因:** 信頼度の閾値が低すぎる

**解決方法:**
```javascript
// minConfidenceを上げる
const results = synonyms.findSynonyms(term, dictionary, {
  minConfidence: 0.85, // デフォルトの0.7から上げる
});
```

### パフォーマンスが遅い

**原因:** 辞書が大きすぎる、または結果数が多すぎる

**解決方法:**
```javascript
// 結果数を制限
const results = synonyms.findSynonyms(term, dictionary, {
  maxResults: 5, // デフォルトの10から減らす
});

// 辞書をフィルタリング
const filteredDict = dictionary.filter((entry) => entry.priority <= 100);
const results = synonyms.findSynonyms(term, filteredDict);
```

---

## ベストプラクティス

### 1. 信頼度の段階的処理

```javascript
// 高信頼度のみで検索
let results = synonyms.findSynonyms(term, dictionary, {
  minConfidence: 0.9,
});

// 結果がなければ閾値を下げる
if (results.length === 0) {
  results = synonyms.findSynonyms(term, dictionary, {
    minConfidence: 0.75,
  });
}
```

### 2. キャッシング

```javascript
// 正規化結果をキャッシュ
const normalizedCache = new Map();

const getNormalized = (text) => {
  if (normalizedCache.has(text)) {
    return normalizedCache.get(text);
  }
  const normalized = synonyms.normalizeText(text);
  normalizedCache.set(text, normalized);
  return normalized;
};
```

### 3. ロギング

```javascript
const results = synonyms.findSynonyms(term, dictionary);

results.forEach((result) => {
  console.log(
      `"${term}" → "${result.matchedTerm}" ` +
    `(信頼度: ${result.confidence.toFixed(2)}, ` +
    `タイプ: ${result.matchType})`,
  );
});
```

---

## 今後の拡張案

### 1. 機械学習ベースの類似度

```javascript
// Word2VecやBERTを使用した意味的類似度
const semanticSimilarity = await calculateSemanticSimilarity(
    "ラーメン",
    "中華そば",
);
```

### 2. カスタム類義語辞書

```javascript
// ユーザー定義の類義語マッピング
const customSynonyms = {
  "ラーメン": ["中華そば", "支那そば", "拉麺"],
  "唐揚げ": ["からあげ", "カラアゲ", "竜田揚げ"],
};
```

### 3. 文脈を考慮した類義語検出

```javascript
// 前後の単語を考慮
const contextualSynonyms = await detectSynonymsWithContext(
    "美味しいラーメン",
    dictionary,
);
```

---

## 参考リンク

- [Levenshtein距離アルゴリズム](https://en.wikipedia.org/wiki/Levenshtein_distance)
- [形態素解析システム](./morphological_analysis.md)
- [データ管理システム](./data_management.md)

---

## まとめ

類義語検出システムの導入により、以下の改善を実現しました:

✅ **表記揺れの吸収** - カタカナ・ひらがな、長音記号の違いを自動処理
✅ **柔軟なマッチング** - 編集距離ベースで類似語を検出
✅ **高精度な翻訳** - 辞書との照合精度が向上
✅ **ユーザビリティ向上** - 入力の多様性を許容
✅ **データ品質向上** - 重複データの統合とクリーニング

これにより、より自然で正確な多言語注文システムが実現できています。
