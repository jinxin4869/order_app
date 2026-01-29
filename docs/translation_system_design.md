# 翻訳システム設計書

## 目的

本ドキュメントでは、専門用語辞書と翻訳APIを組み合わせたハイブリッド翻訳システムのアーキテクチャと処理フローを詳細に定義します。高精度な多言語翻訳を実現するための設計指針を示します。

---

## 1. システム概要

### 1.1 翻訳システムの目標

| 目標           | 説明                   | 成功指標                  |
| -------------- | ---------------------- | ------------------------- |
| **高精度**     | 専門用語を正確に翻訳   | 翻訳精度90%以上           |
| **高速**       | レスポンスタイム最小化 | 平均1秒以内               |
| **コスト効率** | API呼び出し削減        | キャッシュヒット率50%以上 |
| **拡張性**     | 新規言語追加が容易     | 設定のみで言語追加可能    |

### 1.2 翻訳方式の比較

| 方式                     | メリット         | デメリット         | 採用 |
| ------------------------ | ---------------- | ------------------ | ---- |
| **純粋なAPI翻訳**        | 実装が簡単       | 専門用語の誤訳     | ×    |
| **辞書のみ**             | 専門用語に強い   | 未登録語に対応不可 | ×    |
| **ハイブリッド（採用）** | 両方の長所を活用 | 実装が複雑         | ○    |

### 1.3 形態素解析の研究的重要性

**本研究における形態素解析の位置づけ:**

| 観点             | シンプルマッチングのみ     | 形態素解析あり（本研究）               |
| ---------------- | -------------------------- | -------------------------------------- |
| **研究的価値**   | 低（既存技術の組み合わせ） | 高（NLP技術の応用）                    |
| **学術的新規性** | なし                       | 形態素解析 × 機械翻訳の融合            |
| **論文での主張** | 「辞書を使った」のみ       | 「形態素解析により専門用語を自動抽出」 |
| **翻訳精度**     | 部分一致による誤検出あり   | 正確な単語境界認識                     |

**形態素解析が必要な理由（具体例）:**

```
テキスト: "炙りサーモン寿司"

【シンプルマッチング】
- "炙り" を検索 → ヒット ✓
- "サーモン" を検索 → ヒット ✓
- "寿司" を検索 → ヒット ✓
- しかし "炙りサーモン" という存在しない複合語も誤検出する可能性 ✗

【形態素解析あり】
- Kuromoji.jsで解析: ["炙り"(名詞), "サーモン"(名詞), "寿司"(名詞)]
- 正確な単語境界を認識 ✓
- 辞書マッチングの精度向上 ✓
```

**結論**: 形態素解析は本研究の核心的要素であり、研究としての学術的価値を保つために必須です。

### 1.4 フォールバック戦略

本研究では、形態素解析を中心に据えつつ、実装の困難性やエラーに対するロバスト性を確保するため、以下の3層フォールバック戦略を採用します。

| フォールバックレベル | 処理方式                         | 使用条件             | 翻訳精度     |
| -------------------- | -------------------------------- | -------------------- | ------------ |
| **Level 1（推奨）**  | 形態素解析 + 辞書 + API翻訳      | 通常動作時           | 高（90%+）   |
| **Level 2**          | シンプル辞書マッチング + API翻訳 | 形態素解析がエラー時 | 中（70-80%） |
| **Level 3**          | API翻訳のみ                      | 辞書読み込み失敗時   | 中（60-70%） |

#### フォールバック実装例

```javascript
const hybridTranslate = async (text, targetLang) => {
  try {
    // Level 1: 形態素解析あり（本研究の主要方式）
    const tokens = await analyzeText(text); // Kuromoji.js
    const foundTerms = await findSpecializedTerms(tokens);
    const context = generateContext(foundTerms, targetLang);
    const translated = await translateText(text, targetLang, context);
    return {
      text: postProcessTranslation(translated, foundTerms, targetLang),
      method: "morphological_analysis",
      level: 1,
    };
  } catch (error) {
    console.warn("Morphological analysis failed, fallback to Level 2", error);

    try {
      // Level 2: シンプルマッチング
      const foundTerms = await simpleDictionaryMatch(text);
      const translated = await translateText(text, targetLang, foundTerms);
      return {
        text: translated,
        method: "simple_matching",
        level: 2,
        warning: "Using fallback method",
      };
    } catch (error2) {
      console.warn("Dictionary matching failed, fallback to Level 3", error2);

      // Level 3: API翻訳のみ
      const translated = await translateText(text, targetLang, null);
      return {
        text: translated,
        method: "api_only",
        level: 3,
        warning: "Using basic translation only",
      };
    }
  }
};
```

#### シンプルマッチング実装（Level 2用）

```javascript
const simpleDictionaryMatch = async (text) => {
  const dictionary = await loadDictionary();
  const foundTerms = [];

  dictionary.forEach((entry) => {
    // 部分一致検索（形態素解析なし）
    if (text.includes(entry.term_ja)) {
      foundTerms.push({
        original: entry.term_ja,
        translation_en: entry.term_en,
        translation_zh: entry.term_zh,
        category: entry.category,
        priority: entry.priority,
      });
    }
  });

  return foundTerms.sort((a, b) => a.priority - b.priority);
};
```

**重要**: 評価実験では、Level 1（形態素解析あり）の精度とLevel 2（シンプルマッチング）の精度を比較することで、形態素解析の有効性を定量的に示します。

### 1.5 実装方式の選択肢

形態素解析の実装場所について、以下の3つの選択肢を検討します。

| 実装方式                          | メリット                                                     | デメリット                                           | 推奨度 |
| --------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ------ |
| **Option A: フロントエンド実装**  | ・実装が簡単<br>・サーバーコスト不要<br>・オフライン動作可能 | ・アプリサイズ増加（辞書データ）<br>・端末性能に依存 | ★★★    |
| **Option B: Cloud Functions実装** | ・集中管理<br>・辞書更新が容易<br>・端末負荷なし             | ・サーバーコスト発生<br>・ネットワーク必須           | ★★☆    |
| **Option C: ハイブリッド実装**    | ・両方の長所<br>・柔軟性が高い                               | ・実装が複雑<br>・同期管理が必要                     | ★☆☆    |

#### 採用: Option B（Cloud Functions実装）

当初Option A（フロントエンド実装）を検討していましたが、最終的にCloud Functions上に実装しました。

**理由**:

- 辞書データをFirestoreから直接参照でき、辞書更新が即座に反映される
- 翻訳キャッシュ（`translation_cache`コレクション）との連携が容易
- フロントエンドのバンドルサイズ増加を回避
- DeepL APIキーをサーバーサイドで安全に管理

**実装場所**:

- `functions/src/morphological/index.js` - Kuromoji.jsによる形態素解析
- `functions/src/morphological/synonyms.js` - 類義語・表記揺れ検出
- `functions/src/translation/index.js` - ハイブリッド翻訳処理

---

## 2. システムアーキテクチャ

### 2.1 全体構成図（テキスト表現）

```
┌─────────────────────────────────────────────────────────────┐
│                      React Native App (Expo)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ユーザーがメニュー項目を選択                          │  │
│  │  例: "炙りサーモン寿司" を英語で表示                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP Request
                      │ {text: "炙りサーモン寿司", targetLang: "en"}
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions (Node.js)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 1: キャッシュチェック                            │  │
│  │  translation_cache から既存翻訳を検索                 │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │ キャッシュミス                           │
│  ┌────────────────↓─────────────────────────────────────┐  │
│  │  Step 2: 前処理（Pre-processing）                     │  │
│  │  ・Kuromoji.jsで形態素解析                            │  │
│  │  ・専門用語辞書とマッチング                            │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   ↓                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 3: 翻訳API呼び出し                              │  │
│  │  ・DeepL API / Google Translate API                  │  │
│  │  ・専門用語のコンテキスト付与                          │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   ↓                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 4: 後処理（Post-processing）                    │  │
│  │  ・辞書ベースで翻訳結果を補正                          │  │
│  │  ・品質チェック                                       │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   ↓                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 5: キャッシュ保存                               │  │
│  │  translation_cache に結果を保存                       │  │
│  └────────────────┬─────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP Response
                   │ {translatedText: "Seared Salmon Sushi"}
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                      React Native App                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  翻訳結果を画面に表示                                  │  │
│  │  "Seared Salmon Sushi"                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Firestore Database                     │
│  ┌────────────────┐  ┌────────────────┐                    │
│  │   dictionary   │  │ translation_   │                    │
│  │                │  │     cache      │                    │
│  │ 専門用語マスタ  │  │  翻訳結果保存  │                    │
│  └────────────────┘  └────────────────┘                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      External APIs                          │
│  ┌────────────────┐  ┌────────────────┐                    │
│  │   DeepL API    │  │ Google Trans-  │                    │
│  │                │  │   late API     │                    │
│  └────────────────┘  └────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技術スタック

| レイヤー           | 技術                               | 役割                     |
| ------------------ | ---------------------------------- | ------------------------ |
| **フロントエンド** | React Native (Expo)                | ユーザーインターフェース |
| **バックエンド**   | Firebase Cloud Functions (Node.js) | 翻訳処理ロジック         |
| **形態素解析**     | Kuromoji.js                        | 日本語テキストの単語分割 |
| **翻訳API**        | DeepL API                          | 機械翻訳                 |
| **データベース**   | Firestore                          | 辞書・キャッシュ管理     |

---

## 3. 処理フロー詳細

### 3.1 Step 1: キャッシュチェック

#### 目的

既に翻訳済みのテキストを再利用し、API呼び出しを削減。

#### 処理内容

```javascript
// Cloud Functions
const checkCache = async (sourceText, targetLang) => {
  // キャッシュIDを生成（ハッシュ）
  const cacheId = generateCacheId(sourceText, targetLang);

  // Firestoreから検索
  const cacheDoc = await db.collection("translation_cache").doc(cacheId).get();

  if (cacheDoc.exists && !isCacheExpired(cacheDoc.data())) {
    // キャッシュヒット
    await incrementHitCount(cacheId);
    return cacheDoc.data().translated_text;
  }

  // キャッシュミス
  return null;
};
```

#### フローチャート

```
開始
 ↓
キャッシュID生成（SHA-256）
 ↓
Firestoreから検索
 ↓
存在する? ─Yes→ 有効期限内? ─Yes→ キャッシュヒット ─→ 終了（返却）
 │                 │
 No                No
 ↓                 ↓
キャッシュミス ←────┘
 ↓
次のステップへ
```

---

### 3.2 Step 2: 前処理（Pre-processing）

#### 目的

日本語テキストを解析し、専門用語を特定。翻訳APIに渡す前の準備。

#### 処理内容

##### 2-1. 形態素解析（Kuromoji.js）

```javascript
const kuromoji = require("kuromoji");

const analyzeText = (text) => {
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: "node_modules/kuromoji/dict" })
      .build((err, tokenizer) => {
        if (err) reject(err);

        const tokens = tokenizer.tokenize(text);
        // tokens = [
        //   {surface_form: "炙り", pos: "名詞", ...},
        //   {surface_form: "サーモン", pos: "名詞", ...},
        //   {surface_form: "寿司", pos: "名詞", ...}
        // ]

        resolve(tokens);
      });
  });
};
```

**例**: "炙りサーモン寿司" の解析結果

```
炙り: 名詞（調理法）
サーモン: 名詞（食材）
寿司: 名詞（料理名）
```

##### 2-2. 専門用語辞書とマッチング

```javascript
const findSpecializedTerms = async (tokens) => {
  const dictionary = await loadDictionary(); // Firestoreから辞書読み込み
  const foundTerms = [];

  tokens.forEach((token) => {
    const match = dictionary.find(
      (entry) => entry.term_ja === token.surface_form
    );

    if (match) {
      foundTerms.push({
        original: token.surface_form,
        translation_en: match.term_en,
        translation_zh: match.term_zh,
        category: match.category,
        priority: match.priority,
      });
    }
  });

  // 優先度順にソート
  return foundTerms.sort((a, b) => a.priority - b.priority);
};
```

**例**: マッチング結果

```javascript
[
  {
    original: "炙り",
    translation_en: "seared",
    category: "cooking_method",
    priority: 2,
  },
  {
    original: "サーモン",
    translation_en: "salmon",
    category: "ingredient",
    priority: 2,
  },
  {
    original: "寿司",
    translation_en: "sushi",
    category: "dish_name",
    priority: 1,
  },
];
```

##### 2-3. コンテキスト生成

```javascript
const generateContext = (foundTerms, targetLang) => {
  if (foundTerms.length === 0) return null;

  // DeepL Glossary形式
  const glossary = foundTerms.map((term) => ({
    source: term.original,
    target: targetLang === "en" ? term.translation_en : term.translation_zh,
  }));

  return glossary;
};
```

#### フローチャート

```
前処理開始
 ↓
Kuromoji.jsで形態素解析
 ↓
各トークンについて
 ↓
辞書とマッチング
 ↓
ヒット? ─Yes→ foundTermsに追加
 │
 No
 ↓
次のトークンへ
 ↓
すべて処理完了
 ↓
優先度順にソート
 ↓
コンテキスト生成
 ↓
次のステップへ
```

---

### 3.3 Step 3: 翻訳API呼び出し

#### 目的

専門用語のコンテキストを付与して、翻訳APIで高精度な翻訳を実行。

#### DeepL API使用例

```javascript
const translateWithDeepL = async (text, targetLang, context) => {
  const deepl = require("deepl-node");
  const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

  try {
    // 用語集（Glossary）を使用
    let glossaryId = null;
    if (context && context.length > 0) {
      const glossary = await translator.createGlossary(
        "temp_glossary",
        "ja",
        targetLang,
        context
      );
      glossaryId = glossary.glossaryId;
    }

    // 翻訳実行
    const result = await translator.translateText(text, "ja", targetLang, {
      glossary: glossaryId,
    });

    // 一時用語集を削除
    if (glossaryId) {
      await translator.deleteGlossary(glossaryId);
    }

    return result.text;
  } catch (error) {
    console.error("DeepL API Error:", error);
    // フォールバック: Google Translate API
    return await translateWithGoogle(text, targetLang);
  }
};
```

#### フォールバック戦略（実装済み）

実装では、DeepL APIのみを使用し、Google Translate APIは使用していません。
API失敗時のフォールバックは以下の順序です：

1. DeepL API翻訳を試行
2. 失敗時 → 辞書のみで翻訳（`useDictionary`が`true`の場合）
3. それも失敗 → 元のテキストをそのまま返す

```javascript
try {
  translatedText = await translateWithDeepL(text, targetLang);
} catch (apiError) {
  // フォールバック: 辞書のみで翻訳
  if (useDictionary) {
    translatedText = await translateWithDictionaryOnly(text, targetLang);
  }
  if (!translatedText) {
    // 最終フォールバック: 元のテキストを返す
    return { translatedText: text, method: "fallback_original" };
  }
}
```

#### 入出力例

**入力**:

```javascript
{
  text: "炙りサーモン寿司",
  targetLang: "en",
  context: [
    {source: "炙り", target: "seared"},
    {source: "サーモン", target: "salmon"},
    {source: "寿司", target: "sushi"}
  ]
}
```

**出力**:

```javascript
{
  translatedText: "Seared Salmon Sushi",
  method: "deepl_api"
}
```

---

### 3.4 Step 4: 後処理（Post-processing）

#### 目的

翻訳結果を辞書ベースで補正し、品質を保証。

#### 処理内容

##### 4-1. 辞書ベース補正

```javascript
const postProcessTranslation = (translatedText, foundTerms, targetLang) => {
  let correctedText = translatedText;

  foundTerms.forEach((term) => {
    const expectedTranslation =
      targetLang === "en" ? term.translation_en : term.translation_zh;

    // 大文字小文字を無視して検索
    const regex = new RegExp(expectedTranslation, "gi");

    // 辞書の訳語で置換（優先度1-2のみ）
    if (term.priority <= 2) {
      correctedText = correctedText.replace(regex, expectedTranslation);
    }
  });

  return correctedText;
};
```

**例**:

```
翻訳API結果: "Grilled Salmon Sushi" (炙り→Grilledと誤訳)
↓ 辞書補正
最終結果: "Seared Salmon Sushi" (炙り→Searedに補正)
```

##### 4-2. 品質チェック

```javascript
const qualityCheck = (originalText, translatedText, foundTerms) => {
  const checks = {
    hasTranslation: translatedText && translatedText.length > 0,
    notIdentical: originalText !== translatedText,
    lengthReasonable: translatedText.length <= originalText.length * 3,
    containsExpectedTerms: foundTerms.every((term) => {
      const expected = term.translation_en.toLowerCase();
      return translatedText.toLowerCase().includes(expected);
    }),
  };

  const passed = Object.values(checks).every((check) => check === true);

  return { passed, checks };
};
```

##### 4-3. エラーハンドリング

```javascript
const handleTranslationError = (originalText, targetLang) => {
  // フォールバック: 辞書のみで翻訳
  const dictionaryOnlyTranslation = translateWithDictionaryOnly(
    originalText,
    targetLang
  );

  if (dictionaryOnlyTranslation) {
    return {
      translatedText: dictionaryOnlyTranslation,
      method: "dictionary_only",
      warning: "API translation failed, using dictionary only",
    };
  }

  // 最終フォールバック: 元のテキストをそのまま返す
  return {
    translatedText: originalText,
    method: "fallback",
    error: "Translation failed",
  };
};
```

---

### 3.5 Step 5: キャッシュ保存

#### 目的

翻訳結果を保存し、次回以降の高速化とコスト削減。

#### 処理内容

```javascript
const saveToCache = async (sourceText, targetLang, translatedText, method) => {
  const cacheId = generateCacheId(sourceText, targetLang);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30日後

  await db.collection("translation_cache").doc(cacheId).set({
    source_text: sourceText,
    source_lang: "ja",
    target_lang: targetLang,
    translated_text: translatedText,
    translation_method: method,
    hit_count: 0,
    expires_at: expiresAt,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    last_accessed_at: admin.firestore.FieldValue.serverTimestamp(),
  });
};
```

#### キャッシュID生成

```javascript
const crypto = require("crypto");

const generateCacheId = (sourceText, targetLang) => {
  const input = `${sourceText}_${targetLang}`;
  return crypto.createHash("sha256").update(input).digest("hex");
};
```

---

## 4. Cloud Functions実装

### 4.1 メイン関数

```javascript
const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

exports.translateText = onCall(
  { region: "asia-northeast1", secrets: ["DEEPL_API_KEY"], memory: "512MiB" },
  async (request) => {
    const { text, targetLang, useDictionary = true } = request.data;

    // バリデーション
    if (!text || !targetLang) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields"
      );
    }

    if (!["en", "zh"].includes(targetLang)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Unsupported target language"
      );
    }

    try {
      // Step 1: キャッシュチェック
      const cachedTranslation = await checkCache(text, targetLang);
      if (cachedTranslation) {
        return {
          translatedText: cachedTranslation,
          fromCache: true,
        };
      }

      // Step 2: 前処理
      const tokens = await analyzeText(text);
      const foundTerms = await findSpecializedTerms(tokens);
      const context = generateContext(foundTerms, targetLang);

      // Step 3: 翻訳API呼び出し
      const translatedText = await translateText(text, targetLang, context);

      // Step 4: 後処理
      const correctedText = postProcessTranslation(
        translatedText,
        foundTerms,
        targetLang
      );
      const qualityResult = qualityCheck(text, correctedText, foundTerms);

      if (!qualityResult.passed) {
        console.warn("Quality check failed", qualityResult.checks);
      }

      // Step 5: キャッシュ保存
      await saveToCache(text, targetLang, correctedText, "hybrid");

      return {
        translatedText: correctedText,
        fromCache: false,
        foundTerms: foundTerms.length,
        qualityScore: qualityResult.passed ? "high" : "medium",
      };
    } catch (error) {
      console.error("Translation error:", error);
      throw new functions.https.HttpsError("internal", "Translation failed");
    }
  }
);
```

### 4.2 バッチ翻訳関数（メニュー一括翻訳用）

```javascript
exports.batchTranslateMenu = functions.https.onCall(async (data, context) => {
  const { restaurantId, targetLang } = data;

  // 管理者権限チェック
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  // メニュー取得
  const menuSnapshot = await db
    .collection("restaurants")
    .doc(restaurantId)
    .collection("menu_items")
    .get();

  const batch = db.batch();
  const results = [];

  for (const doc of menuSnapshot.docs) {
    const menuItem = doc.data();

    // 名前を翻訳
    const translatedName = await translateTextInternal(
      menuItem.name_ja,
      targetLang
    );

    // 説明を翻訳
    const translatedDesc = menuItem.description_ja
      ? await translateTextInternal(menuItem.description_ja, targetLang)
      : null;

    // Firestoreに保存
    const updateData = {};
    updateData[`name_${targetLang}`] = translatedName;
    if (translatedDesc) {
      updateData[`description_${targetLang}`] = translatedDesc;
    }

    batch.update(doc.ref, updateData);
    results.push({ id: doc.id, ...updateData });
  }

  await batch.commit();

  return {
    count: results.length,
    items: results,
  };
});
```

---

## 5. パフォーマンス最適化

### 5.1 キャッシュ戦略

| 戦略                 | 説明                              | 効果               |
| -------------------- | --------------------------------- | ------------------ |
| **永続キャッシュ**   | Firestoreに30日保存               | API呼び出し削減    |
| **メモリキャッシュ** | Cloud Functions実行中の辞書データ | 辞書読み込み高速化 |
| **プリウォーミング** | 頻出メニューを事前翻訳            | 初回アクセス高速化 |

### 5.2 レスポンスタイム目標

| シナリオ              | 目標時間  | 実測予想  |
| --------------------- | --------- | --------- |
| **キャッシュヒット**  | 100ms以内 | 50-100ms  |
| **辞書のみ翻訳**      | 300ms以内 | 200-300ms |
| **API翻訳（DeepL）**  | 1秒以内   | 500-800ms |
| **API翻訳（Google）** | 1秒以内   | 300-600ms |

### 5.3 コスト削減策

```javascript
// 翻訳リクエストの優先度付け
const shouldTranslate = (text, existingTranslation) => {
  // 既に翻訳済みならスキップ
  if (existingTranslation) return false;

  // 短すぎるテキスト（3文字以下）はスキップ
  if (text.length <= 3) return false;

  // 数字のみはスキップ
  if (/^\d+$/.test(text)) return false;

  return true;
};
```

---

## 6. エラーハンドリング

### 6.1 エラー分類と対応

| エラー種別             | 原因                   | 対応策                           |
| ---------------------- | ---------------------- | -------------------------------- |
| **API制限超過**        | レート制限・無料枠超過 | Google Translateにフォールバック |
| **ネットワークエラー** | タイムアウト・接続失敗 | リトライ（最大3回）              |
| **不正なレスポンス**   | API応答異常            | 辞書のみ翻訳                     |
| **辞書読み込み失敗**   | Firestore接続エラー    | APIのみで翻訳                    |

### 6.2 リトライロジック

```javascript
const retryTranslation = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // 指数バックオフ
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, i))
      );
    }
  }
};
```

---

## 7. 監視・ログ

### 7.1 ログ出力

```javascript
const logTranslation = async (data) => {
  await db.collection("translation_logs").add({
    source_text: data.text,
    target_lang: data.targetLang,
    method: data.method,
    from_cache: data.fromCache,
    found_terms_count: data.foundTermsCount,
    response_time_ms: data.responseTime,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
};
```

### 7.2 監視指標

| 指標                   | 目標値  | アラート条件 |
| ---------------------- | ------- | ------------ |
| **成功率**             | 99%以上 | 95%未満      |
| **平均レスポンス**     | 1秒以内 | 2秒以上      |
| **キャッシュヒット率** | 50%以上 | 30%未満      |
| **API エラー率**       | 1%以下  | 5%以上       |

---

## 8. テスト計画

### 8.1 単体テスト

| テスト対象         | テストケース                 |
| ------------------ | ---------------------------- |
| **形態素解析**     | 正しく単語分割されるか       |
| **辞書マッチング** | 専門用語が正しく抽出されるか |
| **キャッシュ**     | 保存・取得が正常に動作するか |
| **API呼び出し**    | 正しい翻訳結果が返るか       |

### 8.2 統合テスト

| テストケース         | 入力                    | 期待出力              |
| -------------------- | ----------------------- | --------------------- |
| **基本翻訳**         | "寿司" → en             | "Sushi"               |
| **複合語**           | "炙りサーモン寿司" → en | "Seared Salmon Sushi" |
| **未登録語**         | "新メニュー" → en       | API翻訳結果           |
| **キャッシュヒット** | 2回目の同じリクエスト   | 1回目と同じ結果、高速 |

### 8.3 翻訳精度評価

詳細は [evaluation_plan.md](./evaluation_plan.md) を参照。

---

## 9. 将来の拡張

### 9.1 機能拡張案

| 機能               | 説明                             | 優先度 |
| ------------------ | -------------------------------- | ------ |
| **多言語対応拡大** | 韓国語、タイ語等追加             | 中     |
| **音声翻訳**       | 音声入力・出力対応               | 低     |
| **画像認識**       | メニュー画像からOCR→翻訳         | 低     |
| **AI学習**         | ユーザーフィードバックで精度向上 | 中     |

### 9.2 辞書の自動更新

```javascript
// 頻出する未登録語を検出
const detectFrequentUnknownTerms = async () => {
  const logs = await db
    .collection("translation_logs")
    .where("found_terms_count", "==", 0)
    .orderBy("timestamp", "desc")
    .limit(1000)
    .get();

  const termFrequency = {};

  logs.forEach((log) => {
    const text = log.data().source_text;
    termFrequency[text] = (termFrequency[text] || 0) + 1;
  });

  // 10回以上出現した用語を抽出
  const candidates = Object.entries(termFrequency)
    .filter(([_, count]) => count >= 10)
    .sort((a, b) => b[1] - a[1]);

  return candidates;
};
```

---

## 10. 参考資料

- [DeepL API Documentation](https://www.deepl.com/docs-api)
- [Google Cloud Translation API](https://cloud.google.com/translate/docs)
- [Kuromoji.js GitHub](https://github.com/takuyaa/kuromoji.js)
- [Firebase Cloud Functions Best Practices](https://firebase.google.com/docs/functions/tips?hl=ja)

---

## 更新履歴

| 日付       | 更新内容 | 担当者 |
| ---------- | -------- | ------ |
| 2024-11-19 | 初版作成 | -      |
