#!/bin/bash

# WSL環境でのAndroid開発環境セットアップスクリプト
# このスクリプトは、WSL内にJava、Android SDK、エミュレータをインストールします

set -e

echo "======================================"
echo "Android Development Environment Setup for WSL"
echo "======================================"
echo ""

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. OpenJDK 17 のインストール
echo -e "${GREEN}[1/7] Installing OpenJDK 17...${NC}"
sudo apt update
sudo apt install -y openjdk-17-jdk

# Javaバージョン確認
java -version
echo ""

# 2. 必要なパッケージのインストール
echo -e "${GREEN}[2/7] Installing required packages...${NC}"
sudo apt install -y unzip wget curl

# 3. Android SDK ディレクトリの作成
echo -e "${GREEN}[3/7] Creating Android SDK directory...${NC}"
ANDROID_HOME="$HOME/Android/Sdk"
mkdir -p "$ANDROID_HOME"

# 4. Android Command Line Tools のダウンロード
echo -e "${GREEN}[4/7] Downloading Android Command Line Tools...${NC}"
cd /tmp
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
wget -O cmdline-tools.zip "$CMDLINE_TOOLS_URL"

# 5. Command Line Tools の展開
echo -e "${GREEN}[5/7] Extracting Command Line Tools...${NC}"
unzip -q cmdline-tools.zip -d "$ANDROID_HOME/cmdline-tools"
# cmdline-toolsの構造を修正（latest ディレクトリを作成）
mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools/"* "$ANDROID_HOME/cmdline-tools/latest/" 2>/dev/null || true
rmdir "$ANDROID_HOME/cmdline-tools/cmdline-tools" 2>/dev/null || true
rm cmdline-tools.zip

# 6. 環境変数の設定
echo -e "${GREEN}[6/7] Configuring environment variables...${NC}"

# .bashrcに環境変数を追加（既存の設定を削除してから追加）
BASHRC="$HOME/.bashrc"
# 既存のANDROID_HOME設定を削除
sed -i '/ANDROID_HOME.*\/mnt\/c\/Users/d' "$BASHRC"
sed -i '/export ANDROID_HOME/d' "$BASHRC"
sed -i '/export ANDROID_SDK_ROOT/d' "$BASHRC"
sed -i '/ANDROID.*platform-tools/d' "$BASHRC"
sed -i '/ANDROID.*cmdline-tools/d' "$BASHRC"
sed -i '/ANDROID.*emulator/d' "$BASHRC"

# 新しい環境変数を追加
cat >> "$BASHRC" << EOF

# Android SDK Configuration (WSL)
export ANDROID_HOME=\$HOME/Android/Sdk
export ANDROID_SDK_ROOT=\$ANDROID_HOME
export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=\$PATH:\$ANDROID_HOME/platform-tools
export PATH=\$PATH:\$ANDROID_HOME/emulator
export PATH=\$PATH:\$ANDROID_HOME/build-tools/34.0.0
EOF

# 現在のシェルセッションに環境変数を適用
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/emulator"
export PATH="$PATH:$ANDROID_HOME/build-tools/34.0.0"

echo -e "${YELLOW}Environment variables added to ~/.bashrc${NC}"
echo ""

# 7. セットアップ完了メッセージ
echo -e "${GREEN}[7/7] Basic setup completed!${NC}"
echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "1. Reload your shell environment:"
echo "   source ~/.bashrc"
echo ""
echo "2. Run the next script to install Android SDK packages:"
echo "   bash scripts/install-android-packages.sh"
echo ""
echo -e "${GREEN}Setup script completed successfully!${NC}"
