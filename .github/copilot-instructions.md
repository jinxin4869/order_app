# コーディング規約

## はじめに

本規約は、QRコード対応多言語注文システムの開発における、コーディング標準とベストプラクティスを定めたものです。

### プロジェクト概要
- **プロジェクト名**: QRコード対応多言語注文システム
- **目的**: 外国人観光客向けの飲食店注文体験の向上（卒業研究）
- **技術スタック**: React Native + Expo、Firebase Functions、Firestore、DeepL API
- **対応言語**: 日本語、英語、中国語(簡体字)
- **研究的価値**: 形態素解析(Kuromoji.js) × 専門用語辞書 × 機械翻訳の融合

### 本規約の適用範囲
- `functions/` 配下のFirebase Functions実装
- `src/` 配下のReact Nativeアプリケーション実装
- `docs/` 配下の設計資料・仕様書

### 設計資料との関係性
本規約は`docs/`配下の詳細設計資料をもとに作成されています。実装時は必ず対応する設計資料を参照してください。

**回答は必ず日本語で答えてください。**

---

## 1. プロジェクトアーキテクチャ

### 1.1 技術スタック全体像

| レイヤー | 技術 | 用途 |
|---------|------|------|
| **フロントエンド** | React Native 0.73 + Expo ~50.0 | モバイルアプリケーション |
| **バックエンド** | Firebase Functions (Node.js 24) | サーバーレスAPI |
| **データベース** | Cloud Firestore | NoSQLデータストア |
| **認証** | Firebase Authentication | ユーザー認証（将来実装） |
| **翻訳API** | DeepL API (無料プラン) | 機械翻訳 |
| **形態素解析** | Kuromoji.js | 日本語の単語分割 |
| **QRコード** | Expo BarCodeScanner | QRコード読み取り |

### 1.2 フロントエンド構成

```
src/
├── screens/          # 画面コンポーネント (6画面)
├── components/       # 共通コンポーネント
├── services/         # Firebase/API連携
├── hooks/            # カスタムフック (useCart, useLanguage)
├── navigation/       # React Navigation設定
└── constants/        # グローバル定数
```

### 1.3 バックエンド構成

```
functions/
├── src/
│   ├── translation/  # 翻訳システム (ハイブリッド翻訳)
│   ├── orders/       # 注文処理
│   ├── menu/         # メニュー取得
│   └── index.js      # エクスポート統合
├── package.json      # 依存関係 (Node.js 24指定)
└── .eslintrc.js      # ESLint設定 (Google Style)
```

### 1.4 Firestore階層構造

```
/restaurants/{restaurantId}
  /tables/{tableId}
  /menu_categories/{categoryId}
  /menu_items/{itemId}
/orders/{orderId}
/dictionary/{termId}
/translation_cache/{cacheId}
```

**参照**: [docs/database_design.md](../docs/database_design.md)

---

## 2. ファイル・フォルダ構成

### 2.1 ディレクトリ構造標準

- **機能ごとにフォルダを分ける**: 翻訳、注文、メニューなど
- **1フォルダ = 1責務**: Single Responsibility Principle
- **ドキュメントは`docs/`に格納**: 設計資料・仕様書を一元管理

### 2.2 functions/ 配下の構成規則

```
functions/
├── src/
│   ├── [機能名]/
│   │   └── index.js       # 機能のメイン実装
│   └── index.js           # 全機能のエクスポート
├── package.json
├── .eslintrc.js
└── node_modules/
```

**推奨事項**:
- 各機能は独立したフォルダに配置
- ヘルパー関数が多い場合は`utils/`フォルダを作成
- テストファイルは`__tests__/`フォルダに配置

### 2.3 src/ 配下の構成規則

```
src/
├── screens/          # 画面コンポーネント (.js)
├── components/       # 再利用可能コンポーネント (.js)
├── services/         # Firebase/API連携 (.js)
├── hooks/            # カスタムフック (use*.js)
├── navigation/       # ナビゲーション設定
└── constants/        # 定数定義 (index.js)
```

### 2.4 docs/ 配下の管理ルール

```
docs/
├── project_plan.md              # プロジェクト全体計画
├── database_design.md           # Firestore設計
├── translation_system_design.md # 翻訳システム設計
├── qr_code_design.md            # QRコード設計
├── dictionary_design.md         # 専門用語辞書設計
├── menu_sample_design.md        # メニューサンプル
├── development_environment.md   # 環境構築手順
├── detailed_schedule.md         # 詳細スケジュール
├── evaluation_plan.md           # 評価実験計画
└── technology_selection.md      # 技術選定理由
```

**更新義務**:
- コードの仕様変更時は対応するドキュメントを同じコミットで更新
- 新機能追加時は設計書を先に作成（または同時作成）
- 実装と設計書の乖離を禁止

### 2.5 ファイル命名規則

| ファイル種別 | 命名規則 | 例 |
|------------|---------|-----|
| **React Component** | PascalCase.js | `MenuScreen.js`, `LanguageSelectScreen.js` |
| **Hooks** | use + PascalCase.js | `useCart.js`, `useLanguage.js` |
| **Services** | camelCase.js | `firebase.js`, `api.js` |
| **Cloud Functions** | camelCase.js | `translation/index.js` |
| **Constants** | camelCase.js | `constants/index.js` |
| **Docs** | snake_case.md | `database_design.md` |

---

## 3. 命名規則

### 3.1 変数・関数名（キャメルケース）

```javascript
// ✓ Good
const orderList = [];
const targetLang = 'en';
function translateText(text, lang) { }
const handleSubmit = () => { };
```

```javascript
// ✗ Bad
const OrderList = [];        // Pascal case (クラス用)
const target_lang = 'en';    // Snake case (禁止)
function TranslateText() { } // Pascal case (クラス用)
```

### 3.2 クラス名（パスカルケース）

```javascript
// ✓ Good
class OrderManager { }
class TranslationService { }
```

```javascript
// ✗ Bad
class orderManager { }       // Camel case
class translation_service { } // Snake case
```

### 3.3 定数名（大文字＋アンダースコア）

```javascript
// ✓ Good
const MAX_COUNT = 100;
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEFAULT_LANGUAGE = 'ja';
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed'
};
```

```javascript
// ✗ Bad
const maxCount = 100;        // Camel case (変数用)
const DeeplApiKey = '...';   // Pascal case
```

### 3.4 Firestore命名規則

#### コレクション名
- **複数形、小文字、アンダースコア区切り**

```javascript
// ✓ Good
db.collection('menu_items')
db.collection('translation_cache')
db.collection('restaurants')
```

```javascript
// ✗ Bad
db.collection('MenuItem')         // Pascal case
db.collection('menuItems')        // Camel case
db.collection('menu-items')       // ハイフン区切り
```

#### フィールド名
- **小文字、アンダースコア区切り**
- **多言語フィールド**: `{field}_{lang_code}` 形式

```javascript
// ✓ Good
{
  name_ja: '炙りサーモン',
  name_en: 'Seared Salmon',
  name_zh: '炙烤三文鱼',
  created_at: Timestamp,
  updated_at: Timestamp,
  is_available: true
}
```

```javascript
// ✗ Bad
{
  nameJa: '...',              // Camel case
  Name_EN: '...',             // 大文字混在
  createdAt: Timestamp        // Camel case
}
```

### 3.5 Cloud Functions命名規則

```javascript
// ✓ Good: 動詞 + 名詞
exports.translateText = functions.https.onCall(async (data) => { });
exports.createOrder = functions.https.onCall(async (data) => { });
exports.getMenuWithTranslation = functions.https.onCall(async (data) => { });
```

```javascript
// ✗ Bad
exports.Translation = ...    // 名詞のみ
exports.text_translate = ... // Snake case
```

### 3.6 禁止される命名パターン

- **1文字変数**: `i`, `j`, `k` (ループカウンタ以外)
- **曖昧な名前**: `data`, `info`, `temp`, `obj`
- **略語の乱用**: `usr`, `msg`, `btn` (標準的な略語を除く)
- **日本語変数名**: `const 注文リスト = []`

---

## 4. コメント・ドキュメント

### 4.1 JSDoc標準仕様

#### 必須要件
- **すべてのCloud Functions関数にJSDoc必須**
- **20行以上の関数にはJSDoc必須**
- **publicな関数・メソッドにはJSDoc必須**

#### 必須タグ
- `@param {type} name - description` (引数がある場合)
- `@returns {type} description` (戻り値がある場合)
- `@throws {ErrorType} description` (エラーをthrowする場合)

#### 推奨タグ
- `@example` (使用例)
- `@see` (関連ドキュメントへのリンク)

#### 良い例

```javascript
/**
 * テキストを翻訳する
 *
 * ハイブリッド翻訳システムを使用し、キャッシュ→辞書→APIの順で翻訳を試みる
 *
 * @param {Object} data - リクエストデータ
 * @param {string} data.text - 翻訳するテキスト(最大1000文字)
 * @param {string} data.targetLang - 翻訳先言語('en' | 'zh')
 * @param {Object} context - Cloud Functions コンテキスト
 * @returns {Promise<{translatedText: string, fromCache: boolean}>} 翻訳結果
 * @throws {functions.https.HttpsError} invalid-argument - テキストまたは言語が不正
 * @throws {functions.https.HttpsError} internal - 翻訳処理でエラー発生
 * @see docs/translation_system_design.md
 * @example
 * const result = await translateText('炙りサーモン', 'en');
 * // => { translatedText: 'Seared Salmon', fromCache: false }
 */
exports.translateText = functions
  .region('asia-northeast1')
  .https.onCall(async (data, context) => {
    // ...
  });
```

#### 悪い例

```javascript
// ✗ Bad: JSDocが不足
function translateText(text, targetLang) {
  // ...
}

// ✗ Bad: 型情報がない
/**
 * テキストを翻訳する
 */
function translateText(text, targetLang) {
  // ...
}
```

### 4.2 関数コメント規約

**20行以上の関数は必須**:
- 関数の目的
- アルゴリズムの概要(複雑な場合)
- 注意事項・制約

```javascript
/**
 * 専門用語をテキストから抽出
 *
 * アルゴリズム:
 * 1. 辞書データをキャッシュから取得(5分TTL)
 * 2. テキスト内に含まれる専門用語を全探索
 * 3. 優先度順にソート(1が最高優先度)
 *
 * @param {string} text - 検索対象テキスト
 * @returns {Promise<Array<Object>>} 検出された専門用語の配列
 */
const findSpecializedTerms = async (text) => {
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

### 4.3 複雑なロジックへのインラインコメント

**必要な場合**:
- 正規表現
- 複雑な条件分岐
- ビジネスロジックが不明瞭な箇所
- 一時的なワークアラウンド

```javascript
// 優先度が高い用語(1-2)のみ強制補正
// 理由: 低優先度の用語は文脈によって訳が変わる可能性があるため
if (term.priority <= 2) {
  // 大文字小文字を無視して検索・置換
  const regex = new RegExp(
    expectedTranslation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'gi'
  );
  correctedText = correctedText.replace(regex, expectedTranslation);
}
```

### 4.4 TODOコメントの書き方

```javascript
// TODO(担当者): [優先度] 説明
// TODO(jinxi): [高] Kuromoji.js形態素解析の実装
// TODO(team): [中] キャッシュTTLを環境変数化
// FIXME: DeepL APIエラー時のリトライ機構が未実装
```

### 4.5 docs/ドキュメントの最新化ルール

**更新対象ドキュメント**:

| コード変更 | 更新すべきドキュメント |
|-----------|---------------------|
| 翻訳ロジック変更 | [docs/translation_system_design.md](../docs/translation_system_design.md) |
| データベース変更 | [docs/database_design.md](../docs/database_design.md) |
| QRコード仕様変更 | [docs/qr_code_design.md](../docs/qr_code_design.md) |
| API変更 | 各機能の設計書 + [README.md](../README.md) |

---

## 5. コードスタイル

### 5.1 インデント（スペース2つ）

```javascript
// ✓ Good
function example() {
  if (condition) {
    doSomething();
  }
}
```

```javascript
// ✗ Bad: タブ使用
function example() {
→ if (condition) {
→ → doSomething();
→ }
}
```

### 5.2 行の長さ（80文字推奨）

**原則**: 80文字以内

**例外**:
- URL
- 長い文字列リテラル
- インポート文
- 正規表現

```javascript
// ✓ Good: 80文字以内
const result = await db
  .collection('orders')
  .doc(orderId)
  .get();

// ✓ Good: 例外 (URL)
const API_URL = 'https://api-free.deepl.com/v2/translate';

// ✗ Bad: 不必要に長い
const result = await db.collection('orders').doc(orderId).get().then(doc => doc.data());
```

### 5.3 セミコロン必須

```javascript
// ✓ Good
const name = 'example';
doSomething();
```

```javascript
// ✗ Bad
const name = 'example'
doSomething()
```

### 5.4 クォート規則（ESLint準拠）

**ダブルクォート優先** (`.eslintrc.js`設定に従う)

```javascript
// ✓ Good
const message = "Hello, World!";
const template = `Name: ${name}`; // テンプレートリテラルはOK
```

```javascript
// ✗ Bad
const message = 'Hello, World!';  // シングルクォート
```

### 5.5 ブレース規則（One True Brace Style）

```javascript
// ✓ Good
if (condition) {
  doSomething();
} else {
  doOtherThing();
}

// ✗ Bad: Allman style
if (condition)
{
  doSomething();
}
```

### 5.6 空白・改行規則

```javascript
// ✓ Good: 関数間に1行の空行
function first() {
  // ...
}

function second() {
  // ...
}

// ✗ Bad: 不要な連続空行
function first() {
  // ...
}


function second() {
  // ...
}
```

### 5.7 ESLint/Prettier設定

**ESLint設定** (`.eslintrc.js`):
```javascript
{
  extends: ["eslint:recommended", "google"],
  rules: {
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    "prefer-arrow-callback": "error"
  }
}
```

**実行コマンド**:
```bash
npm run lint          # ESLintチェック
npm run lint:fix      # 自動修正
```

---

## 6. 非同期処理規約

### 6.1 async/await必須（Promiseチェーン禁止）

**理由**:
- 可読性向上
- エラーハンドリングの一貫性
- デバッグ容易性

```javascript
// ✓ Good: async/await
const translateText = async (text, targetLang) => {
  const cached = await checkCache(text, targetLang);
  if (cached) return cached;

  const terms = await findSpecializedTerms(text);
  const translated = await translateWithDeepL(text, targetLang);
  await saveToCache(text, targetLang, translated);

  return translated;
};
```

```javascript
// ✗ Bad: Promiseチェーン
const translateText = (text, targetLang) => {
  return checkCache(text, targetLang)
    .then(cached => {
      if (cached) return cached;
      return findSpecializedTerms(text)
        .then(terms => translateWithDeepL(text, targetLang));
    });
};
```

### 6.2 try-catch-finallyパターン

```javascript
exports.translateText = functions.https.onCall(async (data, context) => {
  try {
    // メイン処理
    const result = await performTranslation(data);
    return result;
  } catch (error) {
    // エラーログ出力
    console.error('Translation error:', {
      text: data.text,
      targetLang: data.targetLang,
      error: error.message,
      stack: error.stack
    });

    // ユーザーへのエラーレスポンス
    throw new functions.https.HttpsError(
      'internal',
      '翻訳中にエラーが発生しました'
    );
  }
});
```

### 6.3 並列処理パターン（Promise.all）

```javascript
// ✓ Good: 並列実行(高速)
const [categories, items, restaurant] = await Promise.all([
  db.collection('menu_categories').get(),
  db.collection('menu_items').get(),
  db.collection('restaurants').doc(restaurantId).get()
]);

// ✗ Bad: 直列実行(低速)
const categories = await db.collection('menu_categories').get();
const items = await db.collection('menu_items').get();
const restaurant = await db.collection('restaurants').doc(restaurantId).get();
```

### 6.4 Firebase Functions特有の注意事項

**必ずPromiseを返す**:
```javascript
// ✓ Good
exports.myFunction = functions.https.onCall(async (data, context) => {
  const result = await doSomething();
  return result; // Promiseを返す
});

// ✗ Bad: 非同期処理が完了する前に関数終了
exports.myFunction = functions.https.onCall((data, context) => {
  doSomething(); // awaitなし、返却なし
});
```

---

## 7. エラーハンドリング規約

### 7.1 エラーの分類

**3層エラーハンドリング**:

| エラー種別 | HttpsErrorコード | 用途 |
|-----------|----------------|------|
| **バリデーションエラー** | `invalid-argument` | 入力パラメータ不正 |
| **ビジネスロジックエラー** | `failed-precondition` | 前提条件未充足 |
| **システムエラー** | `internal` | 予期しないエラー |

```javascript
// バリデーションエラー
if (!text || typeof text !== 'string') {
  throw new functions.https.HttpsError(
    'invalid-argument',
    'textは必須で文字列である必要があります'
  );
}

// ビジネスロジックエラー
if (!['en', 'zh'].includes(targetLang)) {
  throw new functions.https.HttpsError(
    'invalid-argument',
    '対応言語はenまたはzhです'
  );
}

// システムエラー (try-catch内)
catch (error) {
  console.error('System error:', error);
  throw new functions.https.HttpsError(
    'internal',
    '内部エラーが発生しました'
  );
}
```

### 7.2 構造化ログ標準

```javascript
// ✓ Good: 構造化ログ
console.error('Translation error:', {
  text: data.text,
  targetLang: data.targetLang,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});

// ✗ Bad: 単純な文字列
console.error('Translation error');
```

### 7.3 ユーザーへのエラーメッセージ設計

- **日本語で分かりやすく**
- **具体的な対処法を提示**
- **機密情報を含めない**

```javascript
// ✓ Good
throw new functions.https.HttpsError(
  'invalid-argument',
  'テキストは1000文字以内で入力してください'
);

// ✗ Bad
throw new functions.https.HttpsError(
  'invalid-argument',
  'Invalid text length'  // 英語、不明瞭
);
```

---

## 8. セキュリティ規約

### 8.1 入力バリデーション必須項目

```javascript
// すべての入力パラメータをバリデーション
if (!text || typeof text !== 'string') {
  throw new functions.https.HttpsError('invalid-argument', 'textが不正です');
}

// 文字列長チェック
if (text.length > 1000) {
  throw new functions.https.HttpsError('invalid-argument', 'テキストは1000文字以内です');
}

// 許可リスト方式（ホワイトリスト）
const ALLOWED_LANGUAGES = ['en', 'zh'];
if (!ALLOWED_LANGUAGES.includes(targetLang)) {
  throw new functions.https.HttpsError('invalid-argument', '対応していない言語です');
}
```

### 8.2 環境変数管理

```javascript
// ✓ Good: 環境変数から取得
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

// ✗ Bad: ハードコード
const DEEPL_API_KEY = 'abc123...';  // 絶対禁止
```

**設定方法**:
```bash
firebase functions:config:set deepl.api_key="YOUR_API_KEY"
```

### 8.3 Firestore Security Rules

**参照**: [docs/database_design.md](../docs/database_design.md)

```javascript
// 例: 注文は全ユーザー作成可能、更新は管理者のみ
match /orders/{orderId} {
  allow create: if request.auth != null;
  allow update: if request.auth.token.admin == true;
  allow read: if request.auth != null;
}
```

---

## 9. Firebase Functions規約

### 9.1 関数設定

```javascript
// リージョン指定: asia-northeast1 (東京)
exports.translateText = functions
  .region('asia-northeast1')
  .runWith({
    timeoutSeconds: 180,  // タイムアウト: 3分
    memory: '512MB'       // メモリ: 512MB
  })
  .https.onCall(async (data, context) => {
    // ...
  });
```

### 9.2 コスト管理

```javascript
// グローバル設定: 最大インスタンス数を制限
const { setGlobalOptions } = require('firebase-functions/v2');
setGlobalOptions({ maxInstances: 10 });
```

### 9.3 ログ出力標準

```javascript
// 通常ログ
console.log('Processing translation:', { text, targetLang });

// エラーログ (構造化)
console.error('Translation failed:', {
  error: error.message,
  stack: error.stack,
  context: { text, targetLang }
});
```

---

## 10. 翻訳システム規約

### 10.1 ハイブリッド翻訳アーキテクチャ

**本研究の核心**: 形態素解析 × 専門用語辞書 × 機械翻訳の融合

### 10.2 3層フォールバック戦略

| Level | 処理方式 | 翻訳精度 | 使用条件 |
|-------|---------|---------|---------|
| **Level 1** | 形態素解析 + 辞書 + API | 90%+ | 通常時（推奨） |
| **Level 2** | 辞書マッチング + API | 70-80% | 形態素解析エラー時 |
| **Level 3** | API翻訳のみ | 60-70% | 辞書読み込み失敗時 |

```javascript
const hybridTranslate = async (text, targetLang) => {
  try {
    // Level 1: 形態素解析あり（本研究の主要方式）
    const tokens = await analyzeText(text); // Kuromoji.js
    const foundTerms = await findSpecializedTerms(tokens);
    const translated = await translateWithDeepL(text, targetLang);
    return postProcessTranslation(translated, foundTerms, targetLang);
  } catch (error) {
    console.warn('Level 1失敗、Level 2へフォールバック', error);

    try {
      // Level 2: シンプルマッチング
      const foundTerms = await simpleDictionaryMatch(text);
      return await translateWithDeepL(text, targetLang);
    } catch (error2) {
      console.warn('Level 2失敗、Level 3へフォールバック', error2);

      // Level 3: API翻訳のみ
      return await translateWithDeepL(text, targetLang);
    }
  }
};
```

### 10.3 専門用語辞書構造

**規模**: 50エントリ

**カテゴリ構成**:
- 料理名: 15エントリ
- 食材: 15エントリ
- 調理法: 10エントリ
- アレルゲン: 10エントリ

**データ構造**:
```javascript
{
  term_ja: '炙りサーモン',
  term_en: 'Seared Salmon',
  term_zh: '炙烤三文鱼',
  category: '料理名',
  priority: 1,  // 1(最高) ~ 5(最低)
  created_at: Timestamp,
  updated_at: Timestamp
}
```

**参照**: [docs/dictionary_design.md](../docs/dictionary_design.md)

### 10.4 キャッシュ戦略

```javascript
// translation_cache コレクション
{
  cache_id: 'sha256(text + targetLang)',
  original_text: '炙りサーモン',
  translated_text: 'Seared Salmon',
  target_lang: 'en',
  hit_count: 5,
  expires_at: Timestamp,      // 30日後
  created_at: Timestamp,
  last_accessed_at: Timestamp
}
```

**TTL設定**:
- 翻訳結果キャッシュ: 30日
- 辞書データキャッシュ: 5分

### 10.5 形態素解析実装基準（Kuromoji.js）

**重要性**: 本研究の学術的価値を保つために必須

```javascript
// フロントエンド実装 (React Native)
import kuromoji from 'kuromoji';

const analyzeText = (text) => {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: '/dict' }).build((err, tokenizer) => {
      if (err) return reject(err);
      const tokens = tokenizer.tokenize(text);
      resolve(tokens);
    });
  });
};
```

**参照**: [docs/translation_system_design.md](../docs/translation_system_design.md)

---

## 11. QRコードシステム規約

### 11.1 QRコードフォーマット

**標準形式**: `{restaurantId}/{tableId}`

```
例:
restaurant_01/table_01
restaurant_01/table_02
restaurant_02/table_01
```

### 11.2 QRコード生成仕様

| 項目 | 仕様 |
|------|------|
| **バージョン** | Version 2-3 |
| **誤り訂正レベル** | M (15%復元) |
| **サイズ** | 5cm × 5cm |
| **印刷** | A5/A6サイズ、ラミネート加工 |

### 11.3 QRコード検証プロトコル

```javascript
// QRコード読み取り後の検証
const validateQRCode = async (qrData) => {
  // フォーマット検証
  const parts = qrData.split('/');
  if (parts.length !== 2) {
    throw new Error('QRコードフォーマットが不正です');
  }

  const [restaurantId, tableId] = parts;

  // Firestore存在確認
  const tableDoc = await db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('tables')
    .doc(tableId)
    .get();

  if (!tableDoc.exists) {
    throw new Error('テーブルが見つかりません');
  }

  // テーブルステータス確認
  const tableData = tableDoc.data();
  if (tableData.status !== 'available') {
    throw new Error('このテーブルは現在使用できません');
  }

  return { restaurantId, tableId };
};
```

**参照**: [docs/qr_code_design.md](../docs/qr_code_design.md)

---

## 12. データベース規約

### 12.1 Firestoreコレクション設計基準

**命名規則**:
- コレクション: 複数形、小文字、アンダースコア区切り
- フィールド: 小文字、アンダースコア区切り

### 12.2 多言語データ構造

```javascript
// メニューアイテムの例
{
  item_id: 'item_001',
  name_ja: '炙りサーモン寿司',
  name_en: 'Seared Salmon Sushi',
  name_zh: '炙烤三文鱼寿司',
  description_ja: 'バーナーで炙った香ばしいサーモン',
  description_en: 'Fragrant salmon seared with a burner',
  description_zh: '用喷枪炙烤的香气四溢的三文鱼',
  price: 880,
  category: 'sushi',
  allergens: ['fish'],
  is_available: true,
  created_at: serverTimestamp(),
  updated_at: serverTimestamp()
}
```

### 12.3 タイムスタンプ管理

**必須フィールド**:
- `created_at`: 作成日時
- `updated_at`: 更新日時

```javascript
// 作成時
await db.collection('menu_items').add({
  // ...
  created_at: admin.firestore.FieldValue.serverTimestamp(),
  updated_at: admin.firestore.FieldValue.serverTimestamp()
});

// 更新時
await db.collection('menu_items').doc(itemId).update({
  // ...
  updated_at: admin.firestore.FieldValue.serverTimestamp()
});
```

**参照**: [docs/database_design.md](../docs/database_design.md)

---

## 13. テスト規約

### 13.1 単体テスト基準

```javascript
// functions/__tests__/translation.test.js
describe('translateText', () => {
  test('should translate Japanese to English', async () => {
    const result = await translateText('炙りサーモン', 'en');
    expect(result.translatedText).toContain('Salmon');
  });

  test('should return from cache on second call', async () => {
    await translateText('寿司', 'en');
    const result = await translateText('寿司', 'en');
    expect(result.fromCache).toBe(true);
  });
});
```

### 13.2 翻訳精度テスト

**目標**: 翻訳精度90%以上

```javascript
// 専門用語50エントリのテスト
const testTranslationAccuracy = async () => {
  const dictionary = await loadDictionary();
  let correctCount = 0;

  for (const entry of dictionary) {
    const result = await translateText(entry.term_ja, 'en');
    if (result.translatedText === entry.term_en) {
      correctCount++;
    }
  }

  const accuracy = (correctCount / dictionary.length) * 100;
  console.log(`翻訳精度: ${accuracy}%`);
  expect(accuracy).toBeGreaterThanOrEqual(90);
};
```

---

## 14. コミット・レビュー

### 14.1 コミットメッセージ規約

**フォーマット**: `[種別] 何を、なぜ変更したか`

```bash
# ✓ Good
git commit -m "[feat] 形態素解析機能を追加 - 翻訳精度向上のため"
git commit -m "[fix] QRコード検証のバグ修正 - 存在しないテーブルでエラー"
git commit -m "[docs] translation_system_design.md更新 - Level 3フォールバック追加"

# ✗ Bad
git commit -m "update"
git commit -m "fix bug"
```

**種別**:
- `[feat]`: 新機能
- `[fix]`: バグ修正
- `[docs]`: ドキュメント更新
- `[refactor]`: リファクタリング
- `[test]`: テスト追加・修正
- `[style]`: フォーマット変更

### 14.2 プルリクエスト作成基準

1. **設計資料の同時更新**: 仕様変更時は必ずドキュメント更新
2. **レビューチェックリスト完了**: [.claude/REVIEW.md](.claude/REVIEW.md)参照
3. **テスト通過**: すべてのテストが成功
4. **ESLintエラーなし**: `npm run lint`成功

---

## 15. パフォーマンス規約

### 15.1 レスポンスタイム目標

| 処理 | 目標時間 |
|------|---------|
| **翻訳処理（キャッシュヒット）** | 1秒以内 |
| **翻訳処理（API呼び出し）** | 3秒以内 |
| **メニュー取得** | 2秒以内 |
| **注文作成** | 2秒以内 |

### 15.2 キャッシュヒット率目標

**目標**: 50%以上

```javascript
// キャッシュヒット率の測定
const cacheStats = {
  hits: 0,
  misses: 0,
  get hitRate() {
    return this.hits / (this.hits + this.misses) * 100;
  }
};
```

### 15.3 Firestore読み取り最適化

```javascript
// ✓ Good: 必要なフィールドのみ取得
const items = await db.collection('menu_items')
  .select('name_ja', 'price', 'is_available')
  .get();

// ✗ Bad: すべてのフィールドを取得
const items = await db.collection('menu_items').get();
```

---

## 16. 評価・品質基準

### 16.1 翻訳精度目標

**目標**: 従来手法比20%向上、絶対精度90%以上

### 16.2 ユーザー満足度目標

**目標**: 平均4.0以上（5段階評価）

### 16.3 タスク完了率目標

**目標**: 90%以上

**評価タスク**:
1. QRコードスキャン
2. 言語選択
3. メニュー閲覧
4. 注文実行

### 16.4 留学生評価実験

**参加者**: 5-8名（英語2-4名、中国語3-4名）
**実験時間**: 15分/人

**参照**: [docs/evaluation_plan.md](../docs/evaluation_plan.md)

---

## 付録

### A. 設計資料一覧

| ドキュメント | 内容 |
|------------|------|
| [project_plan.md](../docs/project_plan.md) | プロジェクト全体計画 |
| [database_design.md](../docs/database_design.md) | Firestore設計 (80ページ) |
| [translation_system_design.md](../docs/translation_system_design.md) | 翻訳システム設計 (80ページ) |
| [qr_code_design.md](../docs/qr_code_design.md) | QRコード設計 (55ページ) |
| [dictionary_design.md](../docs/dictionary_design.md) | 専門用語辞書設計 (45ページ) |
| [menu_sample_design.md](../docs/menu_sample_design.md) | メニューサンプル (40ページ) |
| [development_environment.md](../docs/development_environment.md) | 環境構築手順 (60ページ) |
| [detailed_schedule.md](../docs/detailed_schedule.md) | 詳細スケジュール (80ページ) |
| [evaluation_plan.md](../docs/evaluation_plan.md) | 評価実験計画 (55ページ) |
| [technology_selection.md](../docs/technology_selection.md) | 技術選定理由 (75ページ) |

### B. よくある実装パターン

#### パターン1: Cloud Functions実装

```javascript
exports.functionName = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 180, memory: '512MB' })
  .https.onCall(async (data, context) => {
    try {
      // バリデーション
      if (!data.param) {
        throw new functions.https.HttpsError('invalid-argument', 'paramが必要です');
      }

      // メイン処理
      const result = await processData(data);

      return { success: true, data: result };
    } catch (error) {
      console.error('Error:', error);
      throw new functions.https.HttpsError('internal', 'エラーが発生しました');
    }
  });
```

#### パターン2: Firestore読み書き

```javascript
// 作成
await db.collection('collection_name').add({
  field1: 'value1',
  created_at: admin.firestore.FieldValue.serverTimestamp()
});

// 読み取り
const doc = await db.collection('collection_name').doc(docId).get();
const data = doc.data();

// 更新
await db.collection('collection_name').doc(docId).update({
  field1: 'new_value',
  updated_at: admin.firestore.FieldValue.serverTimestamp()
});
```

### C. トラブルシューティング

| 問題 | 原因 | 解決方法 |
|------|------|---------|
| **翻訳APIエラー** | APIキー未設定 | `firebase functions:config:set deepl.api_key="KEY"` |
| **Firestore権限エラー** | Security Rules不正 | [docs/database_design.md](../docs/database_design.md)参照 |
| **QRコード読み取り失敗** | カメラ権限なし | `expo-barcode-scanner`権限設定確認 |

### D. 用語集

| 用語 | 説明 |
|------|------|
| **ハイブリッド翻訳** | 機械翻訳と専門用語辞書を組み合わせた翻訳方式 |
| **形態素解析** | 日本語テキストを単語単位に分割する技術 (Kuromoji.js) |
| **3層フォールバック** | 3段階の翻訳方式によるエラー耐性の確保 |
| **専門用語辞書** | 料理・食材・調理法などの50エントリの辞書データ |
| **QRコード検証** | QRコードの形式とFirestore存在確認 |

---

**最終更新**: 2024-12-09
**バージョン**: 2.0
**作成者**: プロジェクトチーム

この規約はプロジェクトの設計資料（`docs/`）をもとに作成しています。詳細は各ドキュメントを参照してください。