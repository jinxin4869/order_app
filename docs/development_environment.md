# 開発環境構築手順書

## 目的

本ドキュメントでは、Windows環境でのQRコード対応多言語注文システムの開発環境構築手順を定義します。初心者でも迷わず環境構築できるよう、詳細な手順とトラブルシューティングを記載します。

---

## 1. 開発環境の前提条件

### 1.1 必要なハードウェア (要検証)

| 項目 | 最小要件 | 推奨要件 |
|------|---------|---------|
| **OS** | Windows 10 | Windows 11 |
| **CPU** | Intel Core i3 以上 | Intel Core i5 以上 |
| **メモリ** | 8GB | 16GB |
| **ストレージ** | 10GB 空き容量 | 20GB 空き容量 |
| **ネットワーク** | 常時接続 | 常時接続（Wi-Fi推奨） |

### 1.2 必要なソフトウェア

| ソフトウェア | バージョン | 用途 |
|------------|-----------|------|
| **Node.js** | v18 LTS 以降 | JavaScript実行環境 |
| **npm** | v9 以降 | パッケージ管理 |
| **Git** | 最新版 | バージョン管理 |
| **Visual Studio Code** | 最新版 | コードエディタ |
| **Expo Go アプリ** | 最新版 | 実機テスト（Androidスマホ） |

### 1.3 アカウント

| サービス | 必須/推奨 | 用途 |
|---------|----------|------|
| **GitHub** | 必須 | コード管理 |
| **Firebase (Googleアカウント)** | 必須 | バックエンド・DB |
| **DeepL API** | 必須 | 翻訳API |

---

## 2. 環境構築手順

### 2.1 Node.js インストール

#### 手順

1. **公式サイトにアクセス**
   - URL: https://nodejs.org/
   - 「LTS」版（推奨版）をダウンロード

2. **インストーラー実行**
   - ダウンロードした `.msi` ファイルを実行
   - すべてデフォルト設定でOK
   - 「Automatically install the necessary tools」にチェック

3. **インストール確認**
   - コマンドプロンプトを開く（`Win + R` → `cmd` → Enter）
   - 以下のコマンドを実行:

   ```bash
   node -v
   # 出力例: v18.18.0

   npm -v
   # 出力例: 9.8.1
   ```

#### トラブルシューティング

| 問題 | 解決策 |
|------|-------|
| `node` コマンドが認識されない | PCを再起動 |
| バージョンが古い | 公式サイトから最新LTS版を再インストール |

---

### 2.2 Git インストール

#### 手順

1. **公式サイトにアクセス**
   - URL: https://git-scm.com/
   - 「Download for Windows」をクリック

2. **インストーラー実行**
   - デフォルト設定でOK
   - 「Use Git from Git Bash only」を選択
   - エディタは「Use Visual Studio Code as Git's default editor」を選択

3. **インストール確認**

   ```bash
   git --version
   # 出力例: git version 2.42.0.windows.1
   ```

4. **初期設定**

   ```bash
   git config --global user.name "あなたの名前"
   git config --global user.email "your.email@example.com"
   ```

---

### 2.3 Visual Studio Code インストール

#### 手順

1. **公式サイトにアクセス**
   - URL: https://code.visualstudio.com/
   - 「Download for Windows」をクリック

2. **インストーラー実行**
   - デフォルト設定でOK
   - 「Add to PATH」にチェック

3. **起動確認**
   - デスクトップまたはスタートメニューから起動

#### 推奨拡張機能のインストール

VSCodeを起動後、拡張機能タブ（`Ctrl + Shift + X`）で以下を検索してインストール:

| 拡張機能名 | 用途 |
|-----------|------|
| **ES7+ React/Redux/React-Native snippets** | React Native コード補完 |
| **Prettier** | コードフォーマット |
| **ESLint** | コード品質チェック |
| **React Native Tools** | React Native デバッグ |
| **Firebase Explorer** | Firebase 管理 |
| **Japanese Language Pack** | 日本語化（オプション） |

---

### 2.4 Expo CLI インストール

#### 手順

1. **Expo CLI インストール**

   ```bash
   npm install -g expo-cli
   ```

   ※ `-g` はグローバルインストール（PC全体で使用可能）

2. **インストール確認**

   ```bash
   expo --version
   # 出力例: 6.x.x
   ```

   ※ `expo` コマンドが認識されない場合はPCを再起動

---

### 2.5 Firebase プロジェクト作成

#### 手順

1. **Firebase Console にアクセス**
   - URL: https://console.firebase.google.com/
   - Googleアカウントでログイン

2. **新規プロジェクト作成**
   - 「プロジェクトを追加」をクリック
   - プロジェクト名: `qr-order-system`（任意）
   - Googleアナリティクス: 「有効にする」（推奨）
   - 「プロジェクトを作成」をクリック

3. **Firestore データベース作成**
   - 左メニュー「Firestore Database」→「データベースを作成」
   - ロケーション: `asia-northeast1`（東京）
   - モード: 「本番環境モードで開始」

4. **Firebase Functions 有効化**
   - 左メニュー「Functions」→「使ってみる」
   - Blazeプラン（従量課金）にアップグレード（無料枠あり）

5. **Firebase 設定ファイル取得**
   - プロジェクト設定（歯車アイコン）→「プロジェクトの設定」
   - 「アプリを追加」→「ウェブ」アイコン
   - アプリのニックネーム: `qr-order-app`
   - Firebase SDK の設定をコピー（後で使用）

---

### 2.6 DeepL API キー取得

#### 手順

1. **DeepL アカウント作成**
   - URL: https://www.deepl.com/pro-api
   - 「無料で登録」をクリック
   - メールアドレス・パスワードを入力

2. **API キー取得**
   - ログイン後、「アカウント」→「API キー」
   - 表示されたAPIキーをコピー（後で使用）

3. **無料枠確認**
   - 月50万文字まで無料
   - 使用状況は「アカウント」ページで確認可能

---

## 3. プロジェクトセットアップ

### 3.1 プロジェクトディレクトリ作成

```bash
# ドキュメントフォルダに移動
cd C:\Users\jinxi\ドキュメント\卒業課題

# プロジェクトディレクトリ作成
mkdir qr-order-app
cd qr-order-app
```

### 3.2 Expoプロジェクト作成

```bash
# Expoプロジェクト初期化
npx create-expo-app@latest .

# プロジェクト名を聞かれたら「qr-order-app」と入力
# テンプレートは「blank」を選択
```

### 3.3 必要なパッケージインストール

```bash
# Firebase関連
npm install firebase
npm install @react-native-firebase/app @react-native-firebase/firestore

# ナビゲーション
npm install @react-navigation/native @react-navigation/stack
npx expo install react-native-screens react-native-safe-area-context

# QRコードスキャン
npx expo install expo-barcode-scanner

# その他
npm install axios
npm install react-native-paper
```

### 3.4 Firebase設定ファイル作成

```bash
# プロジェクトルートに firebaseConfig.js を作成
```

**firebaseConfig.js の内容**:

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast1');
```

※ `YOUR_XXX` の部分は、Firebase Consoleから取得した値に置き換え

---

## 4. 開発サーバー起動

### 4.1 Expo開発サーバー起動

```bash
npx expo start
```

**出力例**:
```
› Metro waiting on exp://192.168.1.100:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### 4.2 実機でテスト（Androidスマホ）

1. **Expo Go アプリをインストール**
   - Google Playストアで「Expo Go」を検索してインストール

2. **QRコードをスキャン**
   - Expo Go アプリを起動
   - 「Scan QR Code」をタップ
   - PC画面のQRコードをスキャン

3. **アプリが起動**
   - "Open up App.js to start working on your app!" と表示されればOK

#### トラブルシューティング

| 問題 | 解決策 |
|------|-------|
| QRコードが読み取れない | PC とスマホが同じWi-Fiに接続されているか確認 |
| アプリが起動しない | `npx expo start -c` でキャッシュクリア後に再起動 |
| エラーメッセージ表示 | エラー内容をコピーしてGoogle検索 |

---

## 5. Firebase Functions セットアップ

### 5.1 Firebase CLI インストール

```bash
npm install -g firebase-tools
```

### 5.2 Firebase ログイン

```bash
firebase login
```

ブラウザが開き、Googleアカウントでログイン

### 5.3 Firebase Functions 初期化

```bash
# プロジェクトルートで実行
firebase init functions

# 質問に答える:
# - Use an existing project
# - プロジェクト選択: qr-order-system
# - 言語: JavaScript
# - ESLint: Yes
# - 依存関係インストール: Yes
```

### 5.4 Functions ディレクトリ構造

```
qr-order-app/
├── functions/
│   ├── index.js       # Cloud Functions のコード
│   ├── package.json
│   └── node_modules/
├── App.js
├── firebaseConfig.js
└── package.json
```

---

## 6. 環境変数設定

### 6.1 .env ファイル作成

```bash
# プロジェクトルートに .env ファイル作成
```

**.env の内容**:

```
DEEPL_API_KEY=your_deepl_api_key_here
FIREBASE_API_KEY=your_firebase_api_key_here
```

### 6.2 .env を読み込むパッケージインストール

```bash
npm install react-native-dotenv
```

### 6.3 .gitignore に追加

```bash
# .gitignore に以下を追加
.env
firebaseConfig.js
```

※ API キーなどの機密情報をGitHubに公開しないため

---

## 7. Git リポジトリ初期化

### 7.1 ローカルリポジトリ作成

```bash
git init
git add .
git commit -m "Initial commit"
```

### 7.2 GitHub リポジトリ作成

1. **GitHub にログイン**
   - URL: https://github.com

2. **新規リポジトリ作成**
   - 「New」ボタンをクリック
   - リポジトリ名: `qr-order-app`
   - プライベート: 「Private」を選択
   - 「Create repository」をクリック

3. **ローカルとリモートを紐付け**

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/qr-order-app.git
   git branch -M main
   git push -u origin main
   ```

---

## 8. 動作確認

### 8.1 チェックリスト

開発環境が正しく構築できたか確認:

- [ ] `node -v` でバージョン表示
- [ ] `npm -v` でバージョン表示
- [ ] `git --version` でバージョン表示
- [ ] `expo --version` でバージョン表示
- [ ] `npx expo start` でサーバー起動
- [ ] Expo Go アプリでQRコードスキャン → アプリ起動
- [ ] Firebase Console でプロジェクト確認
- [ ] DeepL API キー取得完了
- [ ] GitHub リポジトリ作成完了

すべてチェックがついたら環境構築完了です!

---

## 9. 推奨VSCode設定

### 9.1 settings.json

VSCodeで `Ctrl + ,` → 「settings.json を開く」をクリックし、以下を追加:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "javascript.updateImportsOnFileMove.enabled": "always",
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000
}
```

### 9.2 .prettierrc 作成

プロジェクトルートに `.prettierrc` ファイルを作成:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

---

## 10. トラブルシューティング集

### 10.1 よくある問題

| 問題 | 原因 | 解決策 |
|------|------|-------|
| **npm install が遅い** | ネットワーク遅延 | `npm config set registry https://registry.npmmirror.com` で中国ミラー使用 |
| **Expo Go で接続できない** | Wi-Fi設定 | PCとスマホを同じWi-Fiに接続 |
| **Firebase エラー** | 設定ミス | firebaseConfig.js の値を再確認 |
| **Git push エラー** | 認証失敗 | `git config --global credential.helper wincred` |
| **VSCode が重い** | 拡張機能多数 | 不要な拡張機能を無効化 |

### 10.2 エラーメッセージ検索

- Google検索: `エラーメッセージ + expo` または `エラーメッセージ + react native`
- Stack Overflow: https://stackoverflow.com/
- Expo Forums: https://forums.expo.dev/

---

## 11. 次のステップ

環境構築が完了したら、以下のドキュメントに進んでください:

1. **[database_design.md](./database_design.md)**: データベース実装
2. **[dictionary_design.md](./dictionary_design.md)**: 辞書データ作成
3. **[menu_sample_design.md](./menu_sample_design.md)**: サンプルメニュー作成
4. **[translation_system_design.md](./translation_system_design.md)**: 翻訳システム実装

---

## 12. 参考資料

### 12.1 公式ドキュメント

| 技術 | URL |
|------|-----|
| **Node.js** | https://nodejs.org/docs/ |
| **Expo** | https://docs.expo.dev/ |
| **Firebase** | https://firebase.google.com/docs |
| **React Navigation** | https://reactnavigation.org/docs/getting-started |
| **DeepL API** | https://www.deepl.com/docs-api |

### 12.2 学習リソース

| リソース | 説明 |
|---------|------|
| **React Native チュートリアル** | https://reactnative.dev/docs/tutorial |
| **Firebase チュートリアル** | https://firebase.google.com/codelabs |
| **Expo 入門** | https://docs.expo.dev/tutorial/introduction/ |

---

## 13. 開発環境の更新

### 13.1 定期的な更新

月1回程度、以下を実行してパッケージを最新化:

```bash
# グローバルパッケージ更新
npm update -g expo-cli firebase-tools

# プロジェクト内パッケージ更新
npm update

# セキュリティ脆弱性チェック
npm audit
npm audit fix
```

---

## 更新履歴

| 日付 | 更新内容 | 担当者 |
|------|---------|--------|
| 2024-11-19 | 初版作成 | - |
