# テストガイド

このプロジェクトには、品質を保証するための自動テストとコード品質チェックが導入されています。

## テスト環境

- **フロントエンド**: Jest + React Native Testing Library
- **バックエンド**: Jest
- **Gitフック**: Husky + lint-staged

---

## テストの実行

### フロントエンド（React Native）

```bash
# すべてのテストを実行
npm test

# ウォッチモードで実行（開発時に便利）
npm run test:watch

# カバレッジレポートを生成
npm run test:coverage
```

### バックエンド（Cloud Functions）

```bash
cd functions

# すべてのテストを実行
npm test

# ウォッチモードで実行
npm run test:watch

# カバレッジレポートを生成
npm run test:coverage
```

---

## テストファイルの構成

### フロントエンド

```
src/
├── components/
│   ├── ErrorBoundary.js
│   └── __tests__/
│       └── ErrorBoundary.test.js
├── hooks/
│   ├── useCart.js
│   ├── useNetworkStatus.js
│   └── __tests__/
│       ├── useCart.test.js
│       └── useNetworkStatus.test.js
└── screens/
    └── __tests__/
        └── (画面のテストファイル)
```

### バックエンド

```
functions/
└── src/
    ├── orders/
    │   └── index.js
    ├── translation/
    │   └── index.js
    └── __tests__/
        ├── orders.test.js
        └── translation.test.js
```

---

## 作成されたテスト

### 1. 注文バリデーションテスト (`functions/src/__tests__/orders.test.js`)

**テストケース:**

- ✅ 有効な注文データはエラーなし
- ✅ レストランIDが必須
- ✅ テーブルIDが必須
- ✅ アイテムが空の場合エラー
- ✅ 数量が1-99の範囲外の場合エラー
- ✅ 特別リクエストが200文字を超える場合エラー
- ✅ HTMLタグがサニタイズされる
- ✅ 金額計算が正しいか検証
- ✅ 金額の1円以内の誤差は許容

### 2. useCartフックテスト (`src/hooks/__tests__/useCart.test.js`)

**テストケース:**

- ✅ 初期状態は空のカート
- ✅ アイテムを追加できる
- ✅ 同じアイテムを追加すると数量が増える
- ✅ 数量を更新できる
- ✅ アイテムを削除できる
- ✅ カートをクリアできる
- ✅ 小計、税、合計が正しく計算される
- ✅ 税は切り捨てで計算される

### 3. useNetworkStatusフックテスト (`src/hooks/__tests__/useNetworkStatus.test.js`)

**テストケース:**

- ✅ 初期状態はオンライン
- ✅ ネットワーク状態の変化を検知する
- ✅ 接続はあるがインターネットに到達不可の場合はオフライン
- ✅ アンマウント時にリスナーを解除する

### 4. ErrorBoundaryテスト (`src/components/__tests__/ErrorBoundary.test.js`)

**テストケース:**

- ✅ エラーがない場合は子コンポーネントを表示
- ✅ エラーが発生した場合はエラーメッセージを表示
- ✅ 再試行ボタンをクリックするとエラー状態がリセットされる
- ✅ エラーメッセージが表示される

---

## Huskyによる自動チェック

Gitコミット時とプッシュ時に自動的にコード品質チェックが実行されます。

### pre-commit フック

**コミット前に自動実行:**

1. ESLintによるコードチェック（自動修正）
2. Prettierによるフォーマット（自動修正）
3. 変更されたファイルに関連するテストを実行

```bash
# コミット時に自動実行される
git add .
git commit -m "feat: 新機能追加"
# → lint-stagedが自動実行される
```

### pre-push フック

**プッシュ前に自動実行:**

1. すべてのテストを実行
2. ESLintによる全ファイルチェック

```bash
# プッシュ時に自動実行される
git push origin main
# → テストとlintが自動実行される
```

### フックをスキップする方法（非推奨）

緊急時のみ使用してください:

```bash
# コミットフックをスキップ
git commit -m "message" --no-verify

# プッシュフックをスキップ
git push --no-verify
```

---

## lint-stagedの設定

コミット時に以下が自動実行されます:

**JavaScriptファイル (_.js, _.jsx):**

1. `eslint --fix` - コードスタイルのチェックと自動修正
2. `prettier --write` - コードフォーマット
3. `jest --bail --findRelatedTests` - 関連テストの実行

**その他のファイル (_.json, _.md):**

1. `prettier --write` - コードフォーマット

---

## テストを書くときのベストプラクティス

### 1. テストの命名

```javascript
describe("機能名", () => {
  test("期待される動作を明確に記述", () => {
    // テストコード
  });
});
```

### 2. AAA パターン

```javascript
test("アイテムを追加できる", () => {
  // Arrange（準備）
  const { result } = renderHook(() => useCart());
  const testItem = { id: "1", name: "Test", price: 100 };

  // Act（実行）
  act(() => {
    result.current.addItem(testItem, 1);
  });

  // Assert（検証）
  expect(result.current.items).toHaveLength(1);
});
```

### 3. モックの使用

```javascript
// 外部依存をモック
jest.mock("@react-native-community/netinfo");

NetInfo.fetch.mockResolvedValue({
  isConnected: true,
  isInternetReachable: true,
});
```

---

## カバレッジレポート

テストカバレッジを確認するには:

```bash
# カバレッジレポートを生成
npm run test:coverage

# レポートを確認
open coverage/lcov-report/index.html
```

**目標カバレッジ:**

- 重要なビジネスロジック: 80%以上
- ユーティリティ関数: 90%以上
- UIコンポーネント: 60%以上

---

## CI/CDへの統合

GitHub Actionsやその他のCI/CDツールでテストを実行する場合:

```yaml
# .github/workflows/test.yml の例
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm install
      - run: npm test
      - run: npm run lint
```

---

## トラブルシューティング

### Huskyが動作しない

```bash
# Huskyを再インストール
npm run prepare
```

### テストが失敗する

```bash
# キャッシュをクリア
npm test -- --clearCache

# node_modulesを再インストール
rm -rf node_modules
npm install
```

### lint-stagedが動作しない

```bash
# lint-stagedを手動実行
npx lint-staged
```

---

## 参考リンク

- [Jest公式ドキュメント](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Husky公式ドキュメント](https://typicode.github.io/husky/)
- [lint-staged公式ドキュメント](https://github.com/okonet/lint-staged)
