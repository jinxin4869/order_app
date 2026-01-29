# WSL環境でのAndroid開発環境セットアップ手順

このガイドでは、WSL（Windows Subsystem for Linux）内にAndroid開発環境を構築し、ExpoプロジェクトをAndroidエミュレータで実行する手順を説明します。

## 概要

WSL環境では、以下のコンポーネントをインストールします:

- OpenJDK 17
- Android SDK Command Line Tools
- Android Platform Tools
- Android Emulator
- Android System Images (x86_64)

## 前提条件

- WSL2がインストールされていること
- Ubuntu または Debian ベースのディストリビューション
- 十分なディスク空き容量（約5GB以上）
- インターネット接続

## セットアップ手順

### ステップ1: 基本環境のセットアップ

最初のスクリプトを実行して、Java と Android SDK Command Line Tools をインストールします。

```bash
cd /home/jinxin/Projects/order_app
bash scripts/setup-android-wsl.sh
```

このスクリプトは以下を実行します:

- OpenJDK 17 のインストール
- 必要なパッケージ（unzip、wget、curl）のインストール
- Android SDK ディレクトリの作成（`~/Android/Sdk`）
- Android Command Line Tools のダウンロードと展開
- 環境変数の設定（`~/.bashrc` に追加）

**実行後、必ずシェルをリロードしてください:**

```bash
source ~/.bashrc
```

### ステップ2: Android SDKパッケージのインストール

環境変数を読み込んだ後、Android SDKの必要なパッケージをインストールします。

```bash
bash scripts/install-android-packages.sh
```

このスクリプトは以下を実行します:

- Android SDKライセンスの同意
- Platform Tools のインストール
- Build Tools とプラットフォーム（API 33, 34）のインストール
- エミュレータのインストール
- システムイメージ（android-34 x86_64）のダウンロード（約1GB）

**注意:** システムイメージのダウンロードには時間がかかります（ネットワーク速度によります）。

### ステップ3: Android Virtual Device (AVD) の作成

エミュレータ用の仮想デバイスを作成します。

```bash
bash scripts/create-avd.sh
```

このスクリプトは以下を実行します:

- AVD名 `ExpoTestDevice` の作成（Pixel 6ベース）
- メモリ、GPU、キーボードの最適設定

既存のAVDがある場合は、削除して再作成するか確認されます。

### ステップ4: エミュレータの起動

AVDを作成したら、エミュレータを起動できます。

```bash
bash scripts/start-emulator.sh
```

**初回起動時の注意:**

- 初回起動は時間がかかります（5〜10分程度）
- エミュレータはバックグラウンドで起動します
- ログは `/tmp/emulator.log` に保存されます

**エミュレータの状態確認:**

```bash
adb devices
```

以下のように表示されれば成功です:

```
List of devices attached
emulator-5554   device
```

### ステップ5: Expoの起動とAndroid接続

新しいターミナルウィンドウを開き、Expoを起動します。

```bash
cd /home/jinxin/Projects/order_app
npm start
```

Expo Dev Tools が起動したら、キーボードで `a` を押すか、以下のコマンドを実行します:

```bash
npx expo run:android
```

アプリがエミュレータにインストールされ、起動します。

## トラブルシューティング

### エミュレータが起動しない場合

1. **KVMが有効か確認:**

   ```bash
   ls -al /dev/kvm
   ```

   存在しない場合は、BIOS/UEFIで仮想化を有効化する必要があります。

2. **WSLgが必要な場合:**
   WSL2でGUIアプリケーションを実行するには、WSLgが必要です。

   ```bash
   wsl --update
   ```

3. **エミュレータログを確認:**
   ```bash
   tail -f /tmp/emulator.log
   ```

### Expoがデバイスを検出しない場合

1. **adbサーバーを再起動:**

   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```

2. **エミュレータが完全に起動しているか確認:**
   ```bash
   adb shell getprop sys.boot_completed
   ```
   `1` が返ってくればOKです。

### 環境変数が読み込まれない場合

```bash
# 環境変数を確認
echo $ANDROID_HOME
# 出力: /home/jinxin/Android/Sdk

# シェルをリロード
source ~/.bashrc

# または新しいターミナルを開く
```

### エミュレータが遅い場合

1. **AVDのメモリを増やす:**

   ```bash
   nano ~/.android/avd/ExpoTestDevice.avd/config.ini
   # hw.ramSize=2048 を 4096 に変更
   ```

2. **GPU設定を変更:**
   ```bash
   $ANDROID_HOME/emulator/emulator -avd ExpoTestDevice -gpu host
   ```

## 便利なコマンド

### AVD一覧を表示

```bash
$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager list avd
```

### インストール済みパッケージを表示

```bash
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --list_installed
```

### エミュレータを停止

```bash
adb emu kill
```

### 既存のAVDを削除

```bash
$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager delete avd -n ExpoTestDevice
```

## 既存のWindows側Android SDKからの移行

もし以前にWindows側のAndroid SDKを使用していた場合（`/mnt/c/Users/...`）、WSL内の環境に切り替えるために:

1. `~/.bashrc` から古い設定を削除（setup-android-wsl.shが自動で行います）
2. 新しい環境変数を適用: `source ~/.bashrc`
3. 必要に応じてExpoのキャッシュをクリア: `npx expo start -c`

## Android Studio を使う場合（GUI）

WSLではなくWindows側のAndroid Studioを使う場合は、以下の手順でAVDを作成できます。

1. Android Studio をダウンロードしてインストール
2. Android Studio を起動して `SDK Manager` を開く
   - Android SDK Platform: 推奨 API レベル 30〜33 をインストール
   - Android SDK Tools / Android SDK Platform-tools / Android Emulator をインストール
3. `AVD Manager` を開き、`Create Virtual Device` を選択
   - 推奨デバイス: Pixel 4 / Pixel 6 系
   - システムイメージ: Google APIs x86_64（API 30〜33）
4. AVD を作成して `Play` ボタンで起動する

### AVD の推奨設定

| 項目             | 推奨値                              |
| ---------------- | ----------------------------------- |
| システムイメージ | `x86_64`（高速）                    |
| API レベル       | 30〜33（安定）                      |
| メモリ           | 1536MB〜4096MB（ホストのRAMに依存） |
| グラフィック     | `automatic` または `hardware`       |
| ストレージ       | デフォルトでOK                      |

## 参考リンク

- [Android Studio Command Line Tools](https://developer.android.com/studio#command-tools)
- [Expo Android Development](https://docs.expo.dev/workflow/android-studio-emulator/)
- [WSL Android Development](https://learn.microsoft.com/en-us/windows/android/wsl-android-dev)

## まとめ

セットアップが完了すると、以下の環境が整います:

- WSL内に完全なAndroid開発環境
- Expoプロジェクトをエミュレータで実行可能
- adb、emulator等のツールがPATHに追加済み

問題が発生した場合は、このドキュメントのトラブルシューティングセクションを参照してください。
