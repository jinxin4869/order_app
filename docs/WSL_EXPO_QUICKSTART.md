# WSL環境でExpoを起動する簡単な方法

WSL環境からWindows側のAndroidエミュレータでExpoアプリを実行する方法をまとめます。

## 前提条件

- ✅ WSL2がインストールされている
- ✅ Node.js と npm がインストールされている
- ✅ Windows側にAndroid Studioがインストールされている
- ✅ Windows側でエミュレータが起動できる

## 🚀 最も簡単な方法: Expo Go アプリを使う

### ステップ1: エミュレータでExpo Goをインストール

1. Android StudioのAVD Managerからエミュレータを起動
2. エミュレータ内でGoogle Play Storeを開く
3. "Expo Go"を検索してインストール

### ステップ2: WSLでExpoを起動

```bash
cd /home/jinxin/Projects/order_app
npm start
```

### ステップ3: QRコードをスキャン

1. Expo Dev Toolsに表示されるQRコードを確認
2. エミュレータでExpo Goアプリを開く
3. "Scan QR Code"をタップ
4. WSLのターミナルに表示されたURLを手動で入力、または`exp://`で始まるURLをコピー&ペースト

**メリット:**
- ビルド不要で即座にテスト可能
- 開発中の変更がリアルタイムで反映（Hot Reload）
- エミュレータだけでなく実機でもテスト可能

---

## 🔧 方法2: ネイティブビルド（開発ビルド）

ネイティブモジュールを使用する場合や、よりプロダクションに近い環境でテストする場合。

### 必要な設定

#### 1. ADBラッパーのセットアップ（初回のみ）

既に作成されています:
- `/home/jinxin/Projects/order_app/.bin/adb` - Windows側の`adb.exe`を呼び出すラッパー

#### 2. local.propertiesの作成（初回のみ）

既に作成されています:
- `/home/jinxin/Projects/order_app/android/local.properties`

### ビルド＆インストール手順

#### 方法A: 環境変数を設定してExpoコマンドを使用

```bash
# ターミナル1: エミュレータが起動していることを確認
/mnt/c/Users/jinxi/AppData/Local/Android/Sdk/platform-tools/adb.exe devices

# ターミナル2: Expoを起動
export PATH=/home/jinxin/Projects/order_app/.bin:$PATH
export ANDROID_HOME=/mnt/c/Users/jinxi/AppData/Local/Android/Sdk
export EXPO_NO_LAUNCH_EMULATOR=1

# Expoを起動（Metro bundlerのみ）
npm start

# 別のターミナルでビルド＆インストール
npx expo run:android --no-build-cache
```

#### 方法B: Gradleを直接使用

```bash
# ADBラッパーをPATHに追加
export PATH=/home/jinxin/Projects/order_app/.bin:$PATH

# Gradleビルド＆インストール
cd android
./gradlew installDebug
cd ..

# Metroサーバーを起動
npm start
```

**注意:**
- 初回ビルドは時間がかかります（NDKダウンロードなど）
- ネイティブコードを変更した場合のみ再ビルドが必要
- JavaScriptの変更はMetroサーバーのHot Reloadで反映

---

## 🐛 トラブルシューティング

### エミュレータが検出されない

```bash
# Windows側のADBでデバイスを確認
/mnt/c/Users/jinxi/AppData/Local/Android/Sdk/platform-tools/adb.exe devices

# 出力例:
# List of devices attached
# emulator-5554   device

# デバイスが表示されない場合
# 1. Android Studioでエミュレータが起動しているか確認
# 2. ADBサーバーを再起動
/mnt/c/Users/jinxi/AppData/Local/Android/Sdk/platform-tools/adb.exe kill-server
/mnt/c/Users/jinxi/AppData/Local/Android/Sdk/platform-tools/adb.exe start-server
```

### "SDK location not found" エラー

`android/local.properties`ファイルが作成されているか確認:

```bash
cat android/local.properties
# 出力: sdk.dir=/mnt/c/Users/jinxi/AppData/Local/Android/Sdk
```

無い場合は作成:

```bash
echo "sdk.dir=/mnt/c/Users/jinxi/AppData/Local/Android/Sdk" > android/local.properties
```

### Expo Goでアプリが表示されない

1. **同じネットワークに接続しているか確認**
   - WSLとエミュレータは同じホスト上なので通常問題なし

2. **URLを手動で入力**
   - Expo Dev Toolsに表示される`exp://xxx.xxx.xxx.xxx:8081`のURLをコピー
   - Expo Goアプリで"Enter URL manually"を選択してペースト

3. **トンネルモードを使用**
   ```bash
   npx expo start --tunnel
   ```

### ビルドが非常に遅い

初回ビルド時にNDK（約1GB）などの大きなファイルをダウンロードするため時間がかかります。

- 2回目以降のビルドは高速になります
- 開発中はExpo Goを使用することを推奨

---

## 📝 推奨ワークフロー

### 日常の開発

1. **Expo Goを使用** - JavaScriptの変更のみの場合
   ```bash
   npm start
   # エミュレータでExpo Goを開く
   ```

### ネイティブモジュール追加時

2. **開発ビルド** - ネイティブコードを変更した場合
   ```bash
   export PATH=/home/jinxin/Projects/order_app/.bin:$PATH
   cd android && ./gradlew installDebug && cd ..
   npm start
   ```

### デプロイ前の最終確認

3. **プロダクションビルド**
   ```bash
   npx expo build:android
   ```

---

## 環境変数まとめ

WSLで開発する際に必要な環境変数:

```bash
# ~/.bashrcに追加済み（新しいターミナルで自動設定）
export ANDROID_HOME=/mnt/c/Users/jinxi/AppData/Local/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$ANDROID_HOME/platform-tools:$PATH
export PATH=$ANDROID_HOME/emulator:$PATH

# プロジェクト固有のPATH（各セッションで設定）
export PATH=/home/jinxin/Projects/order_app/.bin:$PATH
```

---

## まとめ

- **簡単に始める**: Expo Goを使う（ビルド不要）
- **本格的な開発**: 開発ビルドを使う（初回のみ時間がかかる）
- **トラブル時**: ADBラッパーとlocal.propertiesの設定を確認

開発の大部分はExpo Goで十分です。ネイティブモジュールを追加したときだけビルドが必要になります。
