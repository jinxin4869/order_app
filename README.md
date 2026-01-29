# QRコード対応多言語注文システム

## プロジェクト概要

本プロジェクトは、飲食店における外国人観光客向けの多言語対応注文システムです。
QRコードによるテーブル認識、直感的なUI、および専門用語辞書とDeepL APIを活用した高精度な翻訳機能を提供します。

**対応言語:** 日本語（ベース）/ English / 中文

---

## 使い方

### 前提条件

- Node.js v18 以上
- npm v9 以上
- Firebase CLI (`npm install -g firebase-tools`)
- Expo Go アプリ（iOS / Android 実機テスト用）
- DeepL API キー（[無料プラン](https://www.deepl.com/pro-api)で取得可能、月50万文字）

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd order_app
npm install
```

Cloud Functions の依存関係も別途インストールします。

```bash
cd functions
npm install
cd ..
```

### 2. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、Firebase と DeepL の設定値を記入します。

```bash
cp .env.example .env
```

`.env` の内容:

```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
SENTRY_DSN=your_sentry_dsn  # 省略可（本番環境用）
```

Cloud Functions 用の DeepL API キーは Firebase 環境変数で設定します。

```bash
firebase functions:config:set deepl.api_key="YOUR_DEEPL_API_KEY"
```

> `@env` モジュールが見つからないエラーが出た場合は `npm start -- --reset-cache` でキャッシュをクリアしてください。

### 3. Expo 開発サーバーの起動

```bash
npm start
```

起動後、ターミナルに QR コードが表示されます。

| 操作                     | 方法                                 |
| ------------------------ | ------------------------------------ |
| **実機で確認**           | Expo Go アプリで QR コードをスキャン |
| **Android エミュレータ** | `a` キーを押す                       |
| **iOS シミュレータ**     | `i` キーを押す（macOS のみ）         |
| **Web ブラウザ**         | `w` キーを押す                       |

プラットフォーム別に直接起動することも可能です。

```bash
npm run android   # Android
npm run ios       # iOS
npm run web       # Web ブラウザ
```

### 4. Cloud Functions のデプロイ

```bash
# すべてデプロイ
firebase deploy --only functions

# Firestore ルールのみ
firebase deploy --only firestore:rules

# ローカルで動作確認
cd functions && npm run serve
```

### 5. テストの実行

```bash
# すべてのテストを実行
npm test

# ウォッチモード（ファイル変更時に自動再実行）
npm run test:watch

# カバレッジレポート生成
npm run test:coverage

# 特定のファイルのテストのみ
npx jest src/hooks/__tests__/useCart.test.js
```

詳細は [テストガイド](./docs/TESTING.md) を参照してください。

### 6. リント・フォーマット

```bash
npm run lint          # ESLint チェック
npm run lint:fix      # 自動修正
npm run format        # Prettier フォーマット
npm run format:check  # フォーマットチェック（変更なし）
```

Husky + lint-staged により、`git commit` 時に自動で ESLint、Prettier、関連テストが実行されます。テスト失敗時はコミットがブロックされます。

---

## アプリの利用フロー

```
1. QRスキャン → 2. 言語選択 → 3. メニュー閲覧 → 4. 商品詳細 → 5. カート → 6. 注文完了
                                     ↑                                ↓
                                     └────── 追加注文 ───────────────┘
```

| 画面           | 説明                                                          |
| -------------- | ------------------------------------------------------------- |
| **QRスキャン** | テーブルの QR コード（`restaurantId/tableId` 形式）を読み取り |
| **言語選択**   | 日本語・英語・中国語から選択                                  |
| **メニュー**   | カテゴリタブでフィルタ、商品画像・価格・アレルゲン表示        |
| **商品詳細**   | 数量選択、特別リクエスト入力（最大200文字）                   |
| **カート**     | 小計・税額・合計表示、数量変更・削除                          |
| **注文完了**   | 注文番号表示、追加注文またはセッション終了                    |

---

## 主要技術スタック

| レイヤー           | 技術                                | バージョン                                        |
| ------------------ | ----------------------------------- | ------------------------------------------------- |
| **フロントエンド** | React Native (Expo)                 | Expo SDK 54 / React 19.1                          |
| **ナビゲーション** | React Navigation                    | v6 (native-stack)                                 |
| **バックエンド**   | Firebase Cloud Functions v2         | Node.js (asia-northeast1)                         |
| **データベース**   | Firestore                           | サブコレクション構造                              |
| **翻訳**           | DeepL API                           | 専門用語辞書 + 形態素解析によるハイブリッド翻訳   |
| **形態素解析**     | kuromoji.js                         | Cloud Functions 上で実行                          |
| **エラー監視**     | Sentry                              | @sentry/react-native                              |
| **テスト**         | Jest + React Native Testing Library | フロントエンド 11 + バックエンド 4 テストファイル |
| **品質管理**       | ESLint 9 + Prettier + Husky         | コミット時自動チェック                            |

---

## プロジェクト構造

```
order_app/
├── src/                          # フロントエンドソース
│   ├── screens/                  # 画面コンポーネント
│   │   ├── QRScannerScreen.js
│   │   ├── LanguageSelectScreen.js
│   │   ├── MenuScreen.js
│   │   ├── ItemDetailScreen.js
│   │   ├── CartScreen.js
│   │   └── OrderCompleteScreen.js
│   ├── hooks/                    # カスタムフック
│   │   ├── useLanguage.js        # 多言語コンテキスト
│   │   ├── useCart.js            # カート状態管理
│   │   └── useNetworkStatus.js   # ネットワーク監視
│   ├── context/                  # React Context
│   │   └── CartContext.js
│   ├── services/                 # 外部サービス連携
│   │   ├── api.js                # Cloud Functions クライアント
│   │   └── firebase.js           # Firebase 初期化
│   ├── components/               # 共通コンポーネント
│   │   └── ErrorBoundary.js
│   ├── constants/                # 定数（言語、色、税率等）
│   │   └── index.js
│   ├── navigation/               # ナビゲーション設定
│   │   └── AppNavigator.js
│   └── utils/                    # ユーティリティ
│       └── errorHandler.js       # Sentry 統合エラーハンドリング
├── functions/                    # Cloud Functions
│   └── src/
│       ├── index.js              # エントリポイント（全関数エクスポート）
│       ├── translation/          # 翻訳処理
│       ├── menu/                 # メニュー取得・QR検証
│       ├── orders/               # 注文処理
│       ├── morphological/        # 形態素解析・類義語検出
│       └── utils/                # データ統合ユーティリティ
├── docs/                         # ドキュメント一式
├── scripts/                      # データ投入スクリプト
├── App.js                        # アプリエントリポイント
├── package.json
├── eslint.config.mjs
└── firebase.json
```

---

## デモデータ

4店舗分のデモデータが用意されています。

| 店舗名                  | テーブル数 | メニュー品数 |
| ----------------------- | ---------- | ------------ |
| 和食レストラン 桜       | 6          | 69           |
| 居酒屋 海風             | 4          | 69           |
| 寿司処 鮨一             | 4          | 49           |
| カフェ＆ダイニング HANA | 4          | 67           |

投入方法は [scripts/README.md](./scripts/README.md) を参照してください。

---

## ドキュメント一覧

すべての詳細ドキュメントは `docs/` ディレクトリに集約されています。

### 技術設計・仕様

| ドキュメント                                            | 内容                                               |
| ------------------------------------------------------- | -------------------------------------------------- |
| [データベース設計](./docs/database_design.md)           | Firestore サブコレクション構造・セキュリティルール |
| [翻訳システム設計](./docs/translation_system_design.md) | 形態素解析 + DeepL API のハイブリッド翻訳フロー    |
| [専門用語辞書設計](./docs/dictionary_design.md)         | 料理名・調理法の多言語マスターデータ               |
| [QRコード設計](./docs/qr_code_design.md)                | テーブル識別プロトコル・バリデーション             |
| [技術選定理由](./docs/technology_selection.md)          | React Native, Firebase, DeepL 等の採用理由         |

### 高度な解析機能

| ドキュメント                                   | 内容                                      |
| ---------------------------------------------- | ----------------------------------------- |
| [形態素解析](./docs/morphological_analysis.md) | kuromoji.js による日本語トークン化        |
| [類義語検出](./docs/synonym_detection.md)      | 表記揺れ（らーめん/ラーメン等）の自動判定 |
| [データ管理](./docs/data_management.md)        | CSV クレンジングと Firestore 同期         |

### 開発・テスト・評価

| ドキュメント                                      | 内容                                   |
| ------------------------------------------------- | -------------------------------------- |
| [開発環境構築](./docs/development_environment.md) | Windows/macOS セットアップ手順         |
| [Android/WSL設定](./docs/ANDROID_WSL_SETUP.md)    | WSL 環境でのエミュレータ連携・AVD 構成 |
| [テストガイド](./docs/TESTING.md)                 | テスト実行方法・構成・Husky 設定       |
| [評価実験計画](./docs/evaluation_plan.md)         | ユーザー評価の手法と指標               |
| [改善提案](./docs/IMPROVEMENTS.md)                | 課題一覧と今後のロードマップ           |
| [コードレビュー](./docs/CODE_REVIEW_ISSUES.md)    | コード品質の問題追跡                   |
