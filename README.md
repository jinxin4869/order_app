# QRコード対応多言語注文システム

## プロジェクト概要

本プロジェクトは、飲食店における外国人観光客向けの多言語対応注文システムです。
QRコードによるテーブル認識、直感的なUI、および専門用語辞書とDeepL APIを活用した高精度な翻訳機能を提供します。

---

## 🚀 はじめる

開発環境の構築やアプリの起動については、以下のガイドを参照してください。

- **[クイックスタートガイド](./docs/QUICK_START.md)** - 最小限の手順でアプリを起動
- **[テストガイド](./docs/TESTING.md)** - 単体テストとカバレッジの実行方法
- **[プロジェクト改善提案](./docs/IMPROVEMENTS.md)** - 現在の課題と今後のロードマップ

---

## 📄 ドキュメント一覧

すべての詳細ドキュメントは \`docs/\` ディレクトリに集約されています。

### 1. 技術設計・仕様

- **[データベース設計](./docs/database_design.md)** - Firestoreのサブコレクション構造とスキーマ
- **[翻訳システム設計](./docs/translation_system_design.md)** - 形態素解析とAPIを組み合わせた翻訳フロー
- **[専門用語辞書設計](./docs/dictionary_design.md)** - 料理名・調理法の多言語マスターデータ
- **[QRコード設計](./docs/qr_code_design.md)** - テーブル識別プロトコルとデータ構造
- **[技術選定理由](./docs/technology_selection.md)** - React Native, Firebase, DeepL等の採用理由

### 2. 高度な解析機能

- **[形態素解析](./docs/morphological_analysis.md)** - kuromoji.jsによる日本語解析
- **[類義語検出システム](./docs/synonym_detection.md)** - 表記揺れ（らーめん/ラーメン等）の自動判定
- **[データ管理・統合](./docs/data_management.md)** - CSVからのデータクレンジングとFirestore同期

### 3. 開発・評価環境

- **[開発環境構築](./docs/development_environment.md)** - Windows/macOSでの共通セットアップ
- **[Android/WSL設定](./docs/ANDROID_WSL_SETUP.md)** - WSL環境でのエミュレータ連携
- **[AVDセットアップ](./docs/AVD_SETUP.md)** - Android Virtual Deviceの構成
- **[評価実験計画](./docs/evaluation_plan.md)** - ユーザー評価の実施方法と指標

---

## 📊 現在のデータ状況

デモ用データとして以下の4店舗分が用意されており、それぞれ約65〜70種類の豊富なメニュー項目が設定されています。

- **和食レストラン 桜**: 6テーブル / 69品
- **居酒屋 海風**: 4テーブル / 69品
- **寿司処 鮨一**: 4テーブル / 49品
- **カフェ＆ダイニング HANA**: 4テーブル / 67品

詳細は [scripts/README.md](./scripts/README.md) を参照してください。

---

## 🛠 主要技術スタック

- **フロントエンド**: React Native (Expo SDK 52)
- **バックエンド**: Firebase (Firestore, Cloud Functions)
- **翻訳**: DeepL API
- **形態素解析**: kuromoji.js
- **テスト**: Jest, React Native Testing Library
- **品質管理**: ESLint, Prettier, Husky

---

## プロジェクト構造

\`\`\`
order_app/
├── docs/ # ドキュメント一式
├── src/ # アプリケーションソース
│ ├── screens/ # 画面コンポーネント (Menu, Cart, QR, etc.)
│ ├── services/ # Firebase/API 連携ロジック
│ └── context/ # Cartなどの状態管理
├── functions/ # Cloud Functions (翻訳・注文処理)
├── scripts/ # データ投入・メンテナンスタスク
├── 料理データ.csv # マスターデータ
└── README.md # 本ファイル
\`\`\`
