# プロジェクト改善提案

このドキュメントは、プロジェクトのブラッシュアップと本番運用に向けた改善提案をまとめています。

**最終更新日**: 2026-01-11

---

## 🔴 優先度: 高（すぐに対応すべき）

### 1. セキュリティ: 環境変数の適切な管理

**現状の問題:**

- 現在 `react-native-dotenv` を使用していますが、`FIREBASE_API_KEY` などの機密情報がビルドに含まれてしまう可能性があります
- `.env` ファイルが `.gitignore` に含まれていますが、追加のセキュリティ対策が必要です

**推奨対応:**

1. **公開用の環境変数は `EXPO_PUBLIC_` プレフィックスを使用**

   ```bash
   # 公開しても問題ない設定値のみ
   EXPO_PUBLIC_FIREBASE_REGION=asia-northeast1
   ```

2. **機密情報は `expo-secure-store` を使用**

   ```bash
   npm install expo-secure-store
   ```

   ランタイムで必要な機密情報（認証トークンなど）はSecureStoreに保存

3. **ビルド時の機密情報は EAS Build Secrets を使用**
   - Firebase設定などのビルド時の機密情報はEAS Build Secretsで管理
   - 参考: [Expo Environment Variables Documentation](https://docs.expo.dev/guides/environment-variables/)

**参考資料:**

- [React Native Environment Variables: Complete Setup Guide](https://www.brilworks.com/blog/react-native-environment-variables/)
- [Managing React Native Environment Variables](https://medium.com/@Brilworks/managing-react-native-environment-variables-a-guide-for-secure-app-development-591dae7f4218)
- [Expo Security Documentation](https://docs.expo.dev/app-signing/security/)

---

### 2. 依存関係のアップデート

**現状:**
以下のパッケージが古いバージョンです：

| パッケージ                     | 現在    | 最新   | 備考                                       |
| ------------------------------ | ------- | ------ | ------------------------------------------ |
| firebase                       | 10.14.1 | 12.7.0 | メジャーアップデート（破壊的変更の可能性） |
| @react-navigation/native       | 6.1.18  | 7.1.26 | メジャーアップデート                       |
| @react-navigation/native-stack | 6.11.0  | 7.9.0  | メジャーアップデート                       |
| react-native                   | 0.81.5  | 0.83.1 | マイナーアップデート                       |

**推奨対応:**

1. **段階的アップデート:**

   ```bash
   # まずマイナーアップデートから
   npm update react-native-screens
   npm update lint-staged

   # テスト実行
   npm test
   npm run lint
   ```

2. **Firebase v12へのアップデート（注意が必要）:**
   - Firebase v12には破壊的変更がある可能性があります
   - アップデート前に[Firebase JavaScript SDK Release Notes](https://firebase.google.com/support/release-notes/js)を確認
   - テスト環境で動作確認後に本番適用

3. **React Navigation v7へのアップデート:**
   - v7には新機能が追加されていますが、互換性を確認が必要
   - 移行ガイドを参照してアップデート

**アップデート手順:**

```bash
# 1. 依存関係のバックアップ
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

# 2. アップデート実行
npm update

# 3. テスト
npm test
npm run lint
npm start

# 4. 問題があればロールバック
# cp package.json.backup package.json
# npm install
```

---

### 3. テストカバレッジの向上

**現状（2026-01-27更新）:**

- フロントエンドテスト: 11ファイル（ErrorBoundary、useCart、useLanguage、useNetworkStatus、全6画面、api）
- バックエンドテスト: 4ファイル（orders、morphological、synonyms、data-consolidator）
- 主要な画面・フック・サービスのテストは実装済み

**推奨対応:**

1. **テストカバレッジ目標:**

   ```bash
   # カバレッジ計測
   npm run test:coverage

   # 目標: 70%以上のカバレッジ
   ```

---

## 🟡 優先度: 中（計画的に対応）

### 4. エラーハンドリングの強化 ✅ 対応済み

**対応済み（2026-01-27）:**

- `src/utils/errorHandler.js` を作成済み（Sentry統合、リトライロジック含む）
- `initializeSentry()`, `captureError()`, `setUser()`, `addBreadcrumb()` を実装
- `withRetry()` による指数バックオフ付きリトライロジック実装済み
- `App.js` でSentry初期化を呼び出し済み
- 環境変数 `SENTRY_DSN` で本番環境を有効化

**残りの推奨対応:**

1. **オフライン時のキュー機能**
   - API呼び出し失敗時のオフラインキュー（未実装）

---

### 5. パフォーマンス最適化

**推奨対応:**

1. **画像の最適化**
   - メニュー画像の遅延読み込み（Lazy Loading）
   - 画像のキャッシュ戦略

2. **メモ化の活用**

   ```javascript
   // 重い計算処理はuseMemoで最適化
   const filteredItems = useMemo(
     () => menuItems.filter((item) => item.category_id === selectedCategory),
     [menuItems, selectedCategory]
   );
   ```

3. **FlatListの最適化**
   - `initialNumToRender` の調整
   - `windowSize` の最適化
   - `removeClippedSubviews` の有効化

---

### 6. アクセシビリティの向上

**推奨対応:**

1. **アクセシビリティラベルの追加**

   ```javascript
   <TouchableOpacity
     accessible={true}
     accessibilityLabel="カートに追加"
     accessibilityRole="button"
   >
   ```

2. **フォントサイズのスケーリング対応**
   - ユーザーのシステム設定に応じたフォントサイズ調整

---

## 🟢 優先度: 低（余裕があれば対応）

### 7. CI/CDパイプラインの構築

**推奨ツール:**

- GitHub Actions
- EAS Build (Expo Application Services)

**基本的なワークフロー:**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test
      - run: npm run lint
```

---

### 8. ドキュメントの充実

**追加推奨ドキュメント:**

1. **CONTRIBUTING.md** - 開発者向けの貢献ガイド
2. **API.md** - Cloud Functions APIの詳細仕様
3. **DEPLOYMENT.md** - デプロイ手順書
4. **CHANGELOG.md** - 変更履歴

---

### 9. 国際化（i18n）の改善

**現状:**

- ハードコードされた翻訳文字列が多い

**推奨対応:**

1. **react-i18next の導入を検討**

   ```bash
   npm install react-i18next i18next
   ```

2. **翻訳ファイルの集約**
   ```
   src/locales/
   ├── ja.json
   ├── en.json
   └── zh.json
   ```

---

## 📋 実装チェックリスト

### 即座に対応すべき項目

- [ ] 環境変数のセキュリティ対策（expo-secure-store導入）
- [ ] `.env` ファイルの `.gitignore` 確認
- [ ] Firebase v12へのアップデート計画
- [x] 主要画面のテスト追加（全6画面テスト実装済み）

### 1週間以内に対応

- [x] エラーハンドリングの強化（Sentry統合済み）
- [ ] 依存関係の段階的アップデート
- [ ] テストカバレッジ70%達成

### 1ヶ月以内に対応

- [ ] パフォーマンス最適化
- [ ] アクセシビリティ対応
- [ ] CI/CDパイプライン構築

---

## 🔍 追加調査が必要な項目

1. **Firebase v12の破壊的変更の詳細確認**
   - [Firebase JavaScript SDK Release Notes](https://firebase.google.com/support/release-notes/js)を確認
   - 移行ガイドの作成

2. **Expo SDK 54の新機能調査**
   - 現在のExpoバージョンで利用可能な新機能の確認

3. **本番環境でのログ管理戦略**
   - Sentryなどのエラートラッキングサービスの選定

---

## 参考リソース

### セキュリティ

- [React Native Security Best Practices](https://reactnative.dev/docs/security)
- [Expo Security Documentation](https://docs.expo.dev/app-signing/security/)
- [Environment Variables in Expo](https://docs.expo.dev/guides/environment-variables/)

### パフォーマンス

- [React Native Performance](https://reactnative.dev/docs/performance)
- [Optimizing FlatList Configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)

### テスト

- [Testing React Native Apps](https://reactnative.dev/docs/testing-overview)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

---

**次のステップ:**

1. 優先度「高」の項目から着手
2. 各改善項目を実装する際は、必ずテストを実行
3. 大きな変更の前にはブランチを作成してバックアップを取る

このドキュメントは定期的に更新し、プロジェクトの進捗に合わせて調整してください。
