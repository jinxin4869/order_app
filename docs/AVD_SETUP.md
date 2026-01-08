# Android Emulator (AVD) セットアップガイド

このドキュメントは、Android エミュレータ（AVD）を作成し、Expo プロジェクトで実行する方法をまとめています。

## 推奨環境

- OS: Linux / macOS / Windows
- Java: OpenJDK 11 以上
- Android Studio（推奨）

---

## 1. Android Studio を使う（GUI 推奨）

1. Android Studio をダウンロードしてインストール。
2. Android Studio を起動して `SDK Manager` を開く。
   - Android SDK Platform: 推奨 API レベル 30〜33 をインストール
   - Android SDK Tools / Android SDK Platform-tools / Android Emulator をインストール
3. `AVD Manager` を開き、`Create Virtual Device` を選択。
   - 推奨デバイス: Pixel 4 / Pixel 6 系
   - システムイメージ: Google APIs x86_64（API 30〜33）
   - 推奨メモリ/CPU: デフォルトでOK。必要ならメモリを 1536MB 以上に増やす。
4. AVD を作成して `Play` ボタンで起動する。

---

## 2. CLI でのセットアップ（Headless / Linux 環境）

### 必要なツール

- `sdkmanager` / `avdmanager` / `emulator`（Android SDK の一部）
- 環境変数: `ANDROID_SDK_ROOT` または `ANDROID_HOME`

例: Ubuntu の場合（Android Studio を使わない場合）

```bash
# OpenJDK をインストール
sudo apt update
sudo apt install -y openjdk-11-jdk

# Android SDK コマンドラインツールをダウンロード・展開
mkdir -p $HOME/Android/Sdk
cd /tmp
wget https://dl.google.com/android/repository/commandlinetools-linux-9123335_latest.zip -O cmdline-tools.zip
unzip cmdline-tools.zip -d $HOME/Android/Sdk/cmdline-tools

# 環境変数（~/.bashrc 等に追加）
export ANDROID_SDK_ROOT=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator

# 必要なパッケージをインストール
sdkmanager "platform-tools" "platforms;android-31" "emulator" "system-images;android-31;google_apis;x86_64"

# AVD 作成
echo no | avdmanager create avd -n myAVD -k "system-images;android-31;google_apis;x86_64" --device "pixel"

# AVD 起動
$ANDROID_SDK_ROOT/emulator/emulator -avd myAVD
```

---

## 3. AVD の推奨設定

- システムイメージ: `x86_64`（高速）
- API レベル: 30〜33（安定）
- メモリ: 1536MB〜4096MB（ホストのRAMに依存）
- グラフィック: `automatic` または `hardware`（可能なら `hardware`）
- ストレージ: デフォルトでOK

---

## 4. Expo とエミュレータの接続

1. エミュレータを起動する（Android Studio の AVD Manager または上記 CLI）。
2. プロジェクトルートで Expo を起動:

```bash
npm start
# または
npx expo start
```

3. `a` を押すか、新しい端末で:

```bash
expo start --android
# または
npx expo run:android
```

- `npx expo run:android` はネイティブビルド（Android用）を実行します。エミュレータが起動していると自動でアプリがインストールされます。

---

## 5. トラブルシューティング

- エミュレータが起動しない／クラッシュする場合:
  - `emulator -list-avds` で AVD 名を確認し、`emulator -avd <name> -gpu host` を試す
  - ホストの仮想化（VT-x / AMD-V）が有効か確認
- Expo がデバイスを検出しない場合:
  - `adb devices` でエミュレータが表示されるか確認
  - `adb kill-server && adb start-server`

---

## 6. 参考コマンドまとめ

```bash
# AVD一覧
$ANDROID_SDK_ROOT/emulator/emulator -list-avds

# AVD起動
$ANDROID_SDK_ROOT/emulator/emulator -avd <name>

# adbでデバイス確認
adb devices

# Expo起動
npx expo start

# ExpoからAndroidへ起動
npx expo run:android
```

---

必要なら、このドキュメントを `docs/SETUP_GUIDE.md` の該当箇所に統合することも可能です。
