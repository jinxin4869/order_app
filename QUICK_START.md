# クイックスタートガイド 🚀

最速でアプリを起動するための簡易ガイドです。

---

## ✅ 必要なもの

- [x] Firebase プロジェクト（作成済み）
- [x] DeepL API キー（オプション）
- [ ] `.env` ファイルの設定

---

## 📝 手順（3ステップ）

### 1️⃣ 環境変数の設定

`.env` ファイルを編集して、Firebase の設定値を入力:

```bash
# .env ファイル
FIREBASE_API_KEY=あなたのAPIキー
FIREBASE_AUTH_DOMAIN=プロジェクトID.firebaseapp.com
FIREBASE_PROJECT_ID=プロジェクトID
FIREBASE_STORAGE_BUCKET=プロジェクトID.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=送信者ID
FIREBASE_APP_ID=アプリID
FIREBASE_MEASUREMENT_ID=測定ID
FIREBASE_FUNCTIONS_REGION=asia-northeast1
```

**Firebase コンソールで値を取得:**
1. https://console.firebase.google.com/
2. プロジェクト設定 → 全般 → マイアプ → SDK の設定
3. 値をコピーして `.env` に貼り付け

### 2️⃣ 依存関係をインストール

```bash
# プロジェクトルートで
npm install

# Cloud Functions の依存関係も
cd functions
npm install
cd ..
```

### 3️⃣ アプリを起動

```bash
npm start
```

表示されたQRコードをスマホの Expo Go アプリでスキャン！

---

## 🔧 追加設定（オプション）

### Firebase のデプロイ

```bash
# Firestore ルールをデプロイ
firebase deploy --only firestore:rules,firestore:indexes

# Cloud Functions をデプロイ
firebase deploy --only functions
```

### DeepL API キーの設定

```bash
firebase functions:config:set deepl.api_key="あなたのAPIキー"
```

### データ統合

```bash
cd functions
npm run consolidate
```

---

## ❓ トラブルシューティング

### "Cannot find module '@env'" エラー

```bash
# キャッシュをクリアして再起動
npm start -- --reset-cache
```

### Firebase エラー

1. `.env` ファイルの値を確認
2. Firebase コンソールで値を再確認
3. アプリを再起動

---

## 📖 詳細ドキュメント

もっと詳しく知りたい場合は:

- **[完全セットアップガイド](./docs/SETUP_GUIDE.md)** - 詳細な手順
- **[トラブルシューティング](./docs/SETUP_GUIDE.md#-トラブルシューティング)** - よくある問題

---

## 🎉 完了！

以上でアプリが起動できます！

```
▄▄▄▄▄▄▄  ▄  ▄ ▄▄▄▄  ▄▄▄▄▄▄▄
█ ▄▄▄ █ ██▀█ ▄ ▀▄▄█ █ ▄▄▄ █
█ ███ █ ▀ ▀█  █▀▄▀█ █ ███ █
█▄▄▄▄▄█ ▄▀█ ▄ ▄▀▄ █ █▄▄▄▄▄█
▄▄▄▄▄ ▄▄▀ ▀ ██▄▄ █▀▄ ▄ ▄ ▄
 ▄▄█▀▄▄ ▄█▄▀▀▀ ▀▀▄█▀▀▀▀▀▀▄█
▄ ▀▀█ ▄▄ ▄█▄██▄▀▄█▀▀ █▄█ ▄
▄▄▄▄▄▄▄ ▀ ▀▀█ █▄▄▀ █ ▄ ██▀█
█ ▄▄▄ █ ▀█ ▀  █▄  ▄▄▄█▀█▄██
█ ███ █ █▄  █▄▀▄▀▀ ▀▄▄▄▄█ ▀
█▄▄▄▄▄█ ██ ▄▀▀▄▄▀█▄▄▀▀▀▄  █
```

このQRコードをスマホでスキャンしてください！
