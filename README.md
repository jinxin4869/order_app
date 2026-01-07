# QRコード対応多言語注文システム ドキュメント一覧

## プロジェクト概要

本プロジェクトは、外国人観光客向けの多言語対応注文システムを開発する卒業研究です。QRコードによるテーブル認識、チャットボット形式のUI、専門用語辞書を活用した高精度翻訳により、言語の壁を超えた飲食店での注文体験を実現します。

### 対応言語
- 日本語（ベース言語）
- 中国語（優先実装）
- 英語

### 主要技術スタック
- **フロントエンド**: React Native (Expo)
- **バックエンド**: Firebase (Firestore, Cloud Functions)
- **翻訳API**: DeepL API
- **形態素解析**: kuromoji.js（日本語の品詞解析・専門用語抽出）
- **テスト**: Jest + React Native Testing Library
- **品質管理**: Husky + lint-staged（自動Lint・テスト実行）

---

## ドキュメント一覧

### 1. 技術選定・設計関連

#### [technology_selection.md](./technology_selection.md)
技術選定の詳細比較と推奨理由
- Expo vs React Native CLI
- DeepL API vs Google Translate API
- 開発・テスト環境の選定
- 予算・API利用制限の分析

#### [database_design.md](./database_design.md)
Firestoreデータベースの詳細設計
- コレクション構造
- フィールド仕様（型、必須/任意、ユニーク制約、Null許容等）
- リレーション設計
- セキュリティルール
- サンプルデータ

#### [dictionary_design.md](./dictionary_design.md)
専門用語辞書の設計と初期データ
- CSVフォーマット定義
- カテゴリ分類（料理名、食材、調理法、アレルゲン）
- 優先度別用語リスト
- 50-100エントリのサンプルデータ

#### [translation_system_design.md](./translation_system_design.md)
翻訳システムのアーキテクチャと処理フロー
- システム全体構成
- 前処理（形態素解析・専門用語抽出）
- 翻訳API呼び出し（コンテキスト付与）
- 後処理（辞書ベース補正）
- エラーハンドリング

#### [morphological_analysis.md](./docs/morphological_analysis.md)
形態素解析システム（kuromoji.js）の詳細
- kuromoji.jsの概要と選定理由
- 形態素解析の基本機能
- 専門用語抽出アルゴリズム
- 翻訳システムへの統合方法
- パフォーマンス最適化
- 使用例とトラブルシューティング

#### [qr_code_design.md](./qr_code_design.md)
QRコードシステムの設計
- データフォーマット
- 店舗ID + テーブルID構造
- 生成方法
- セキュリティ考慮事項

---

### 2. 実装・開発関連

#### [menu_sample_design.md](./menu_sample_design.md)
テスト用メニューデータの設計
- カテゴリ構成（5-7カテゴリ）
- 30-50メニュー項目の具体例
- 価格設定
- アレルゲン情報

#### [development_environment.md](./development_environment.md)
開発環境構築の詳細手順
- 必要なソフトウェア一覧
- インストール手順（Windows向け）
- Expo + Firebase セットアップ
- トラブルシューティング

---

### 3. 評価・スケジュール関連

#### [evaluation_plan.md](./evaluation_plan.md)
評価実験の計画書
- 実験目的・仮説
- 対象者（留学生）の募集方法
- 評価項目（定量・定性）
- アンケート設計
- データ収集・分析手法

#### [detailed_schedule.md](./detailed_schedule.md)
3ヶ月間の詳細スケジュール
- 週次タスク分解（Week 1-12）
- マイルストーン
- 各タスクの成果物・完了条件
- リスク管理

---

## ドキュメント使用ガイド

### 初回確認時に重点的に確認すべきドキュメント

1. **[technology_selection.md](./technology_selection.md)** - 技術選定の妥当性確認
2. **[database_design.md](./database_design.md)** - データ構造の適切性確認
3. **[evaluation_plan.md](./evaluation_plan.md)** - 評価方法の妥当性確認
4. **[detailed_schedule.md](./detailed_schedule.md)** - スケジュールの実現可能性確認

### 実装開始時に参照すべきドキュメント

1. **[development_environment.md](./development_environment.md)** - 環境構築
2. **[database_design.md](./database_design.md)** - DB実装
3. **[dictionary_design.md](./dictionary_design.md)** - 辞書データ作成
4. **[menu_sample_design.md](./menu_sample_design.md)** - テストデータ作成

### 評価実験時に参照すべきドキュメント

1. **[evaluation_plan.md](./evaluation_plan.md)** - 実験手順
2. **[tables_template.md](./tables_template.md)** - データ記録用テンプレート

---

## 更新履歴

| 日付 | 更新内容 | 担当者 |
|------|---------|--------|
| 2024-11-19 | 初版作成（全ドキュメント整備） | - |

---

## 連絡先・リポジトリ

- **リポジトリ**: （GitHub URLを記載予定）

## プロジェクト構造

```
qr-order-app/
├── App.js                    # アプリエントリーポイント
├── src/
│   ├── screens/              # 画面コンポーネント
│   │   ├── QRScannerScreen.js
│   │   ├── LanguageSelectScreen.js
│   │   ├── MenuScreen.js
│   │   ├── ItemDetailScreen.js
│   │   ├── CartScreen.js
│   │   └── OrderCompleteScreen.js
│   ├── components/           # 共通コンポーネント
│   ├── services/             # Firebase/API連携
│   │   ├── firebase.js
│   │   └── api.js
│   ├── hooks/                # カスタムフック
│   │   ├── useCart.js
│   │   └── useLanguage.js
│   ├── navigation/           # ナビゲーション
│   │   └── AppNavigator.js
│   └── constants/            # 定数
│       └── index.js
├── functions/                # Cloud Functions
│   ├── src/
│   │   ├── index.js          # エントリーポイント
│   │   ├── translation/      # 翻訳機能
│   │   ├── orders/           # 注文処理
│   │   └── menu/             # メニュー取得
│   └── package.json
├── scripts/                  # ユーティリティスクリプト
│   └── import_sample_data.js
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```

## セットアップ手順

### 1. 前提条件

- Node.js v18以上
- npm または yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Expo CLI (`npm install -g expo-cli`)
- Firebase プロジェクト（作成済み）
- DeepL API キー

### 2. リポジトリのクローン

```bash
git clone <repository-url>
cd qr-order-app
```

### 3. アプリ側の依存関係インストール

```bash
npm install
```

### 4. Cloud Functions の依存関係インストール

```bash
cd functions
npm install
cd ..
```

### 5. Firebase 設定

#### 5.1 Firebase にログイン

```bash
firebase login
```

#### 5.2 プロジェクトを選択

```bash
firebase use <your-project-id>
```

#### 5.3 DeepL API キーを設定

```bash
firebase functions:config:set deepl.api_key="YOUR_DEEPL_API_KEY"
```

### 6. Firebase 設定ファイルの更新

`src/services/firebase.js` を開き、Firebase Console から取得した設定値を入力:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 7. Firestore ルールとインデックスのデプロイ

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 8. Cloud Functions のデプロイ

```bash
firebase deploy --only functions
```

### 9. サンプルデータのインポート

```bash
# Firebase Admin SDK のサービスアカウントキーをダウンロードして設定
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"

# データインポート
node scripts/import_sample_data.js
```

### 10. アプリの起動

```bash
npx expo start
```

Expo Go アプリでQRコードをスキャンしてテスト！

## 開発コマンド

```bash
# アプリ起動
npx expo start

# Cloud Functions のローカルテスト
cd functions && npm run serve

# Cloud Functions のデプロイ
firebase deploy --only functions

# Firestore ルールのデプロイ
firebase deploy --only firestore:rules
```

## QRコードフォーマット

QRコードには以下のフォーマットでデータを含める:

```
{restaurantId}/{tableId}

例: restaurant_01/table_01
```

## 環境変数

### Cloud Functions

| 変数名 | 説明 |
|--------|------|
| `deepl.api_key` | DeepL API キー |

設定方法:
```bash
firebase functions:config:set deepl.api_key="YOUR_KEY"
```

## 注意事項

- DeepL API の無料枠は月50万文字まで
- Cloud Functions のリージョンは `asia-northeast1`（東京）を使用
- 本番環境では適切な認証とセキュリティ設定を行うこと


## 作成者
