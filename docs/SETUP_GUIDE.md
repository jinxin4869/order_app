# セットアップガイド

このドキュメントでは、プロジェクトの初期セットアップ手順を説明します。

---

## 📋 前提条件

- Node.js 18以上がインストールされている
- Firebase プロジェクトが作成済み
- DeepL API キーを取得済み（推奨）

---

## 🚀 セットアップ手順

### 1. 依存関係のインストール

```bash
# プロジェクトルートで実行
npm install

# Cloud Functions の依存関係もインストール
cd functions
npm install
cd ..
```

---

### 2. Firebase設定

#### 2-1. `.env` ファイルの作成

プロジェクトルートに `.env` ファイルを作成し、Firebase コンソールから取得した設定値を入力します。

**手順:**

1. Firebase コンソール (https://console.firebase.google.com/) を開く
2. プロジェクト設定 → 全般 → マイアプ → ウェブアプリ を選択
3. 「SDK の設定と構成」から設定値をコピー

**`.env` ファイルの例:**

```bash
# Firebase Configuration
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=qr-order-system-f1acb.firebaseapp.com
FIREBASE_PROJECT_ID=qr-order-system-f1acb
FIREBASE_STORAGE_BUCKET=qr-order-system-f1acb.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
FIREBASE_FUNCTIONS_REGION=asia-northeast1
```

**重要:**
- `.env` ファイルは `.gitignore` に含まれているため、Gitにコミットされません
- 実際の値は Firebase コンソールから取得してください
- `.env.example` をコピーして使用できます

#### 2-2. Firestore のセキュリティルールをデプロイ

```bash
# Firestore のルールとインデックスをデプロイ
firebase deploy --only firestore:rules,firestore:indexes
```

**確認事項:**
- `firestore.rules` ファイルが存在することを確認
- `firestore.indexes.json` ファイルが存在することを確認

---

### 3. DeepL API の設定

#### 3-1. DeepL API キーの取得

1. https://www.deepl.com/pro-api にアクセス
2. 無料アカウント登録（月50万文字まで無料）
3. API キーをコピー

#### 3-2. Firebase Functions に API キーを設定

```bash
# DeepL API キーを設定
firebase functions:config:set deepl.api_key="YOUR_DEEPL_API_KEY_HERE"

# 設定を確認
firebase functions:config:get
```

**出力例:**
```json
{
  "deepl": {
    "api_key": "your-api-key-here"
  }
}
```

**ローカル開発の場合:**

`functions/.runtimeconfig.json` を作成（本番環境では不要）:

```json
{
  "deepl": {
    "api_key": "YOUR_DEEPL_API_KEY_HERE"
  }
}
```

**注意:** `.runtimeconfig.json` は `.gitignore` に含まれています

---

### 4. Cloud Functions のデプロイ

```bash
# すべての Functions をデプロイ
firebase deploy --only functions

# 特定の関数のみデプロイする場合
firebase deploy --only functions:translateText
firebase deploy --only functions:batchTranslateMenu
```

**デプロイ時のメモリ設定:**

kuromoji.js を使用するため、メモリを 512MB 以上に設定することを推奨します。
これは `functions/src/index.js` で設定済みです:

```javascript
exports.translateText = functions
  .region("asia-northeast1")
  .runWith({ memory: "512MB" })
  .https.onCall(async (data, context) => {
    // ...
  });
```

---

### 5. データの準備

#### 5-1. 専門用語辞書の統合

```bash
cd functions

# CSVファイルを統合してJSONを生成
npm run consolidate
```

**出力:** `consolidated_dictionary.json`

#### 5-2. 辞書データを Firestore にインポート

インポートスクリプトを作成（将来実装）:

```bash
# TODO: インポートスクリプトの実装
node scripts/import-dictionary.js
```

---

### 6. アプリの起動

#### 6-1. 開発サーバーの起動

```bash
# Expo 開発サーバーを起動
npm start
```

起動後、以下のオプションが表示されます:

- **a** - Android デバイス/エミュレータで開く
- **i** - iOS シミュレータで開く（Mac のみ）
- **w** - Web ブラウザで開く

#### 6-2. QRコードでスマホから接続

Expo Go アプリをインストールし、QR コードをスキャンして接続できます。

---

### 7. テストの実行

```bash
# フロントエンドのテスト
npm test

# Cloud Functions のテスト
cd functions
npm test
```

---

## 🔧 トラブルシューティング

### エラー: "Cannot find module '@env'"

**原因:** `babel.config.js` に `react-native-dotenv` プラグインが設定されていない

**解決方法:**

1. `babel.config.js` が正しく設定されているか確認
2. キャッシュをクリアして再起動:

```bash
# Expo のキャッシュをクリア
expo start -c

# または
npm start -- --reset-cache
```

### エラー: "Firebase: Error (auth/invalid-api-key)"

**原因:** `.env` ファイルの API キーが正しくない

**解決方法:**

1. Firebase コンソールから正しい API キーを取得
2. `.env` ファイルを更新
3. アプリを再起動

### Cloud Functions のデプロイエラー

**エラー例:**
```
Error: Failed to configure biiling for project
```

**解決方法:**

Firebase Blaze プラン（従量課金制）にアップグレードする必要があります:

1. Firebase コンソール → プロジェクト設定 → 使用状況と料金
2. 「プランをアップグレード」をクリック
3. Blaze プランを選択（無料枠あり）

### kuromoji.js のメモリエラー

**エラー例:**
```
Error: Function execution took too long, timing out after 60s
```

**解決方法:**

Cloud Functions のメモリを増やす（既に設定済みですが、確認してください）:

```javascript
// functions/src/index.js
exports.translateText = functions
  .region("asia-northeast1")
  .runWith({
    memory: "512MB",  // 256MB → 512MB に変更
    timeoutSeconds: 120  // タイムアウトも延長
  })
  .https.onCall(async (data, context) => {
    // ...
  });
```

---

## 📱 推奨開発環境

### Android

- Android Studio がインストールされている
- Android エミュレータが設定済み
- または実機（Expo Go アプリをインストール）

### iOS（Mac のみ）

- Xcode がインストールされている
- iOS シミュレータが利用可能
- または実機（Expo Go アプリをインストール）

### Web

- モダンブラウザ（Chrome, Firefox, Safari など）
- Expo の Web サポートを利用

---

## 🔐 セキュリティに関する注意事項

### `.env` ファイル

- **絶対に Git にコミットしないでください**
- `.gitignore` に含まれていることを確認
- チームメンバーと共有する場合は、安全な方法（パスワード管理ツールなど）を使用

### API キー

- Firebase API キーは公開されても問題ありませんが、セキュリティルールで保護してください
- DeepL API キーは **絶対に公開しないでください**
- Cloud Functions の環境変数として安全に保管

### Firestore セキュリティルール

現在の設定:

```javascript
// 読み取り: すべてのユーザー
// 書き込み: 禁止（Cloud Functions のみ）

match /restaurants/{restaurantId} {
  allow read: if true;
  allow write: if false;
}
```

本番環境では、さらに厳格なルールを設定してください。

---

## 📂 ファイル構成

```
order_app/
├── .env                          # 環境変数（Gitには含まれない）
├── .env.example                  # 環境変数のサンプル
├── babel.config.js               # Babel設定
├── package.json                  # プロジェクト設定
├── firebase.json                 # Firebase設定
├── firestore.rules               # Firestoreセキュリティルール
├── firestore.indexes.json        # Firestoreインデックス
├── App.js                        # アプリのエントリーポイント
├── src/
│   ├── services/
│   │   └── firebase.js           # Firebase初期化（.envから読み込み）
│   ├── screens/                  # 画面コンポーネント
│   ├── components/               # 再利用可能なコンポーネント
│   └── hooks/                    # カスタムフック
├── functions/
│   ├── src/
│   │   ├── morphological/        # 形態素解析
│   │   ├── translation/          # 翻訳システム
│   │   ├── orders/               # 注文処理
│   │   └── utils/                # ユーティリティ
│   ├── scripts/
│   │   └── consolidate-data.js   # データ統合スクリプト
│   └── package.json              # Functions の依存関係
├── docs/                         # ドキュメント
└── 料理データ.csv                # 料理用語辞書
```

---

## 📚 次のステップ

セットアップが完了したら、以下のドキュメントを参照してください:

1. **[形態素解析システム](./morphological_analysis.md)** - 日本語テキスト解析の詳細
2. **[類義語検出システム](./synonym_detection.md)** - 表記揺れの処理方法
3. **[データ管理システム](./data_management.md)** - 辞書データの管理
4. **[テストガイド](../TESTING.md)** - テストの実行とデバッグ

---

## ✅ セットアップチェックリスト

- [ ] Node.js と npm がインストールされている
- [ ] 依存関係がインストールされている（`npm install`）
- [ ] `.env` ファイルが作成され、Firebase 設定が入力されている
- [ ] `babel.config.js` が正しく設定されている
- [ ] Firebase プロジェクトが作成されている
- [ ] Firestore のルールとインデックスがデプロイされている
- [ ] DeepL API キーが Firebase Functions に設定されている
- [ ] Cloud Functions がデプロイされている
- [ ] データが統合されている（`npm run consolidate`）
- [ ] アプリが起動できる（`npm start`）
- [ ] テストが通る（`npm test`）

---

## 🎉 完了！

セットアップが完了しました！アプリを起動して、QR コード注文システムを試してみましょう。

```bash
npm start
```

質問や問題がある場合は、各ドキュメントのトラブルシューティングセクションを参照してください。
