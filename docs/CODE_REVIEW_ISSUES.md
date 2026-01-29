# コードレビュー 問題点リスト

**レビュー日**: 2026-01-27
**レビュー対象**: order_app リポジトリ全体
**レビュー観点**: コード品質、セキュリティ、パフォーマンス、テスト、ドキュメント整合性

---

## 目次

1. [CRITICAL（緊急）](#1-critical緊急)
2. [HIGH（高優先度）](#2-high高優先度)
3. [MEDIUM（中優先度）](#3-medium中優先度)
4. [LOW（低優先度）](#4-low低優先度)
5. [Vercel React Best Practices レビュー](#5-vercel-react-best-practices-レビュー)
6. [対応優先度マトリクス](#6-対応優先度マトリクス)

---

## 1. CRITICAL（緊急）

### 1.1 ~~デバッグボタンが本番コードに残存~~ ✅ 対応済み

| 項目     | 内容                             |
| -------- | -------------------------------- |
| ファイル | `src/screens/QRScannerScreen.js` |
| 行番号   | ~~76-93, 174-177~~               |
| 深刻度   | **CRITICAL**                     |
| カテゴリ | セキュリティ                     |
| **状態** | ✅ **2026-01-27 対応完了**       |

**対応内容**: デバッグボタン（`handleDebugSkip` 関数）とそのUIコンポーネント、関連スタイルを完全に削除。

---

### 1.2 ~~ハードコードされたテストデータ~~ ✅ 対応済み

| 項目     | 内容                             |
| -------- | -------------------------------- |
| ファイル | `src/screens/QRScannerScreen.js` |
| 行番号   | ~~76-93~~                        |
| 深刻度   | **CRITICAL**                     |
| カテゴリ | セキュリティ                     |
| **状態** | ✅ **2026-01-27 対応完了**       |

**対応内容**: 1.1 と同時に削除済み。

---

### 1.3 ~~A/Bテスト用の「DeepLのみ翻訳」モード未実装~~ ✅ 対応済み

| 項目     | 内容                                                        |
| -------- | ----------------------------------------------------------- |
| ファイル | `functions/src/translation/index.js`, `src/services/api.js` |
| 深刻度   | **CRITICAL**（評価実験の前提条件）                          |
| カテゴリ | 機能不足                                                    |
| **状態** | ✅ **2026-01-27 対応完了**                                  |

**対応内容**:

- `useDictionary` パラメータを追加（デフォルト: `true`）
- `false` の場合は辞書検索をスキップし、DeepLのみで翻訳
- フロントエンドAPIにもオプション引数を追加
- キャッシュキーを分離してA/Bテスト結果の混在を防止

```javascript
// 使用例
await translateText("炙りサーモン", "en", { useDictionary: false }); // DeepLのみ
await translateText("炙りサーモン", "en", { useDictionary: true }); // ハイブリッド
```

---

## 2. HIGH（高優先度）

### 2.1 ~~エラートラッキング未実装~~ ✅ 対応済み

| 項目     | 内容                        |
| -------- | --------------------------- |
| ファイル | `src/utils/errorHandler.js` |
| 深刻度   | **HIGH**                    |
| カテゴリ | 運用                        |
| **状態** | ✅ **2026-01-27 対応完了**  |

**対応内容**:

- Sentry React Native SDKの統合コードを追加
- `initializeSentry()` - アプリ起動時に呼び出す初期化関数
- `captureError()` - エラーをSentryに送信
- `setUser()` - ユーザー情報（テーブル、言語等）を設定
- `addBreadcrumb()` - カスタムブレッドクラムを追加
- 開発環境ではコンソールのみ、本番環境ではSentryに送信

**追加実装完了（2026-01-27）**:

- `App.js` で `initializeSentry()` を呼び出すように更新
- `app.config.js` を作成し、環境変数から `sentryDsn` を読み込むように設定

**本番環境設定**:

- 環境変数 `SENTRY_DSN` を設定してSentryを有効化

---

### 2.2 ~~重要画面のテスト欠如~~ ✅ 対応済み

| 項目         | 内容                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| 対象ファイル | `OrderCompleteScreen.js`, `LanguageSelectScreen.js`, `QRScannerScreen.js` |
| 深刻度       | **HIGH**                                                                  |
| カテゴリ     | テスト                                                                    |
| **状態**     | ✅ **2026-01-27 対応完了**                                                |

**対応内容**: 以下のテストファイルを作成

- `src/screens/__tests__/OrderCompleteScreen.test.js` - 10テストケース
- `src/screens/__tests__/LanguageSelectScreen.test.js` - 9テストケース
- `src/screens/__tests__/QRScannerScreen.test.js` - 10テストケース

---

### 2.3 ~~注文関数のバックエンドテスト欠如~~ ✅ 対応済み

| 項目     | 内容                                     |
| -------- | ---------------------------------------- |
| ファイル | `functions/src/__tests__/orders.test.js` |
| 深刻度   | **HIGH**                                 |
| カテゴリ | テスト                                   |
| **状態** | ✅ **2026-01-27 対応完了**               |

**対応内容**: 既存のテストファイルに以下を追加

- 注文ステータス遷移のテスト（有効な遷移、無効な遷移、キャンセル可能なステータス）
- 注文番号生成のテスト

---

### 2.4 ~~OrderCompleteScreenへのパラメータ未渡し~~ ✅ 対応済み

| 項目     | 内容                        |
| -------- | --------------------------- |
| ファイル | `src/screens/CartScreen.js` |
| 深刻度   | **HIGH**                    |
| カテゴリ | バグ                        |
| **状態** | ✅ **2026-01-27 対応完了**  |

**対応内容**:

- `restaurantId` と `tableId` をナビゲーションパラメータに追加
- 注文データに `name_en`, `name_zh` も追加（3.3.1も同時に対応）

---

## 3. MEDIUM（中優先度）

### 3.1 コード品質

#### 3.1.1 console.log残存（MenuScreen）

| 項目     | 内容                        |
| -------- | --------------------------- |
| ファイル | `src/screens/MenuScreen.js` |
| 行番号   | 34, 50, 63                  |
| 深刻度   | **MEDIUM**                  |

**問題**: デバッグ用の `console.log` が本番コードに残存。

---

#### 3.1.2 console.log残存（CartScreen）

| 項目     | 内容                        |
| -------- | --------------------------- |
| ファイル | `src/screens/CartScreen.js` |
| 行番号   | 65, 83, 144, 201            |
| 深刻度   | **MEDIUM**                  |

---

#### 3.1.3 重複コメント

| 項目     | 内容                   |
| -------- | ---------------------- |
| ファイル | `src/hooks/useCart.js` |
| 行番号   | 47-48                  |
| 深刻度   | **LOW**                |

**問題**: `// 商品の数量を更新` コメントが重複している。

---

#### 3.1.4 Alert.alertのonPressがラップされていない

| 項目     | 内容                        |
| -------- | --------------------------- |
| ファイル | `src/screens/CartScreen.js` |
| 行番号   | 105                         |
| 深刻度   | **MEDIUM**                  |

**問題**: `onPress: submitOrder` が直接渡されており、Alertからの引数を受け取る可能性がある。

**修正方法**:

```javascript
// Before
onPress: submitOrder;

// After
onPress: () => submitOrder();
```

---

### 3.2 パフォーマンス

#### 3.2.1 filteredItemsがメモ化されていない

| 項目     | 内容                        |
| -------- | --------------------------- |
| ファイル | `src/screens/MenuScreen.js` |
| 行番号   | 79                          |
| ルール   | `rerender-memo`             |
| 深刻度   | **MEDIUM**                  |

**問題**: `filteredItems` が毎回のレンダリングで再計算される。

**修正方法**:

```javascript
// Before
const filteredItems = menuItems.filter(
  (item) => item.category_id === selectedCategory && item.is_available
);

// After
const filteredItems = useMemo(
  () =>
    menuItems.filter(
      (item) => item.category_id === selectedCategory && item.is_available
    ),
  [menuItems, selectedCategory]
);
```

---

#### 3.2.2 renderItem関数がコンポーネント内で定義

| 項目     | 内容                        |
| -------- | --------------------------- |
| ファイル | `src/screens/MenuScreen.js` |
| 行番号   | 103-121, 124-170            |
| ルール   | `rendering-hoist-jsx`       |
| 深刻度   | **MEDIUM**                  |

**問題**: `renderCategoryTab` と `renderMenuItem` がコンポーネント内で定義されており、毎回新しい関数が作成される。

**修正方法**: 外部コンポーネントとして抽出し、`React.memo` でラップする。

---

#### 3.2.3 renderCartItemがコンポーネント内で定義

| 項目     | 内容                        |
| -------- | --------------------------- |
| ファイル | `src/screens/CartScreen.js` |
| 行番号   | 159-209                     |
| ルール   | `rendering-hoist-jsx`       |
| 深刻度   | **MEDIUM**                  |

---

### 3.3 データ整合性

#### 3.3.1 ~~注文データにname_en/name_zh未保存~~ ✅ 対応済み

| 項目     | 内容                                         |
| -------- | -------------------------------------------- |
| ファイル | `src/screens/CartScreen.js`                  |
| 行番号   | 119-126                                      |
| 深刻度   | **MEDIUM**                                   |
| **状態** | ✅ **2026-01-27 対応完了** (2.4と同時に対応) |

**対応内容**: `name_en`, `name_zh` を注文データに追加

---

#### 3.3.2 多言語フォールバックの不一致

| 項目         | 内容       |
| ------------ | ---------- |
| 対象ファイル | 複数       |
| 深刻度       | **MEDIUM** |

**問題**: ファイルによって多言語フォールバックのパターンが異なる。

| ファイル         | フォールバックパターン                     |
| ---------------- | ------------------------------------------ |
| `CartScreen.js`  | `name_zh` → `name_en` → `name_ja` → `name` |
| `menu/index.js`  | `name_ja` のみ                             |
| `useLanguage.js` | `name_ja` → `name`                         |

**修正方法**: 共通のヘルパー関数を使用して統一する。

---

## 4. LOW（低優先度）

### 4.1 辞書キャッシュTTL最適化

| 項目     | 内容                                 |
| -------- | ------------------------------------ |
| ファイル | `functions/src/translation/index.js` |
| 行番号   | 38                                   |
| 深刻度   | **LOW**                              |

**問題**: 辞書キャッシュのTTLが5分と短い。Cloud Functionsのインスタンス間でキャッシュが共有されないため、メモリ効率が悪い。

---

### 4.2 Firestoreクエリの最適化

| 項目     | 内容                          |
| -------- | ----------------------------- |
| ファイル | `functions/src/menu/index.js` |
| 行番号   | 57-62, 91-96                  |
| 深刻度   | **LOW**                       |

**問題**: クエリでデータを取得後、メモリ内でソートしている。インデックスエラーを避けるための対応だが、スケール時に問題になる可能性がある。

---

### 4.3 getMenuItem関数が未使用

| 項目     | 内容                          |
| -------- | ----------------------------- |
| ファイル | `functions/src/menu/index.js` |
| 深刻度   | **LOW**                       |

**問題**: `getMenuItem()` Cloud Functionが定義されているが、フロントエンドから呼び出されていない（デッドコード）。

---

### 4.4 未使用変数

| 項目     | 内容                        |
| -------- | --------------------------- |
| ファイル | `src/screens/CartScreen.js` |
| 行番号   | 20                          |
| 深刻度   | **LOW**                     |

**問題**: `restaurant`, `table` が destructure されているが、レンダリングで使用されていない。

---

## 5. Vercel React Best Practices レビュー

### 適用可能なルールと現状

| ルール                         | 状態    | 問題箇所               | 推奨修正                             |
| ------------------------------ | ------- | ---------------------- | ------------------------------------ |
| `rerender-memo`                | ❌ 違反 | MenuScreen L79         | `useMemo`でフィルタ結果をメモ化      |
| `rerender-functional-setstate` | ✅ 準拠 | useCart.js             | 正しくfunctional updateを使用        |
| `rendering-hoist-jsx`          | ❌ 違反 | MenuScreen, CartScreen | renderItem関数を外部コンポーネント化 |
| `js-early-exit`                | ✅ 準拠 | 各画面                 | ローディング・エラー時に早期リターン |
| `rerender-lazy-state-init`     | ✅ 準拠 | -                      | 複雑な初期化なし                     |

### 修正例: `rerender-memo`

**Before** (`MenuScreen.js` L79):

```javascript
const filteredItems = menuItems.filter(
  (item) => item.category_id === selectedCategory && item.is_available
);
```

**After**:

```javascript
const filteredItems = useMemo(
  () =>
    menuItems.filter(
      (item) => item.category_id === selectedCategory && item.is_available
    ),
  [menuItems, selectedCategory]
);
```

### 修正例: `rendering-hoist-jsx`

**Before** (`MenuScreen.js`):

```javascript
const MenuScreen = ({ navigation, route }) => {
  // ...
  const renderMenuItem = ({ item }) => (
    <TouchableOpacity ...>
      {/* JSX */}
    </TouchableOpacity>
  );
  // ...
};
```

**After**:

```javascript
// コンポーネント外で定義
const MenuItem = React.memo(({ item, onPress, getItemName, getItemDescription }) => (
  <TouchableOpacity onPress={() => onPress(item)} ...>
    {/* JSX */}
  </TouchableOpacity>
));

const MenuScreen = ({ navigation, route }) => {
  // ...
  const renderMenuItem = useCallback(
    ({ item }) => (
      <MenuItem
        item={item}
        onPress={handleItemPress}
        getItemName={getItemName}
        getItemDescription={getItemDescription}
      />
    ),
    [handleItemPress, getItemName, getItemDescription]
  );
  // ...
};
```

---

## 6. 対応優先度マトリクス

```
            影響度
        低      中      高
    ┌───────┬───────┬───────┐
 高 │ 4.1-  │ 3.2   │ 1.1-  │ ← 緊急度
    │ 4.4   │ 3.3   │ 1.3   │
    ├───────┼───────┼───────┤
 中 │       │ 3.1   │ 2.1-  │
    │       │       │ 2.4   │
    ├───────┼───────┼───────┤
 低 │       │       │       │
    └───────┴───────┴───────┘
```

### 推奨対応順序

| フェーズ    | 期限         | 対象    | 内容                                 |
| ----------- | ------------ | ------- | ------------------------------------ |
| **Phase 1** | 即時         | 1.1-1.3 | セキュリティ問題、評価実験の前提条件 |
| **Phase 2** | 今週中       | 2.1-2.4 | エラートラッキング、テスト、バグ修正 |
| **Phase 3** | 次回リリース | 3.1-3.3 | コード品質、パフォーマンス最適化     |
| **Phase 4** | 時間があれば | 4.1-4.4 | 最適化、デッドコード削除             |

---

## 変更履歴

| 日付       | 内容                                                              |
| ---------- | ----------------------------------------------------------------- |
| 2026-01-27 | 初版作成                                                          |
| 2026-01-27 | CRITICAL 1.1-1.3, HIGH 2.1-2.4 対応完了                           |
| 2026-01-27 | Sentry統合完了（App.js, app.config.js設定追加）、ESLintエラー修正 |
