#!/bin/bash

# Android SDK パッケージインストールスクリプト
# このスクリプトは、必要なAndroid SDKコンポーネントをインストールします

set -e

echo "======================================"
echo "Installing Android SDK Packages"
echo "======================================"
echo ""

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 環境変数の確認
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${RED}Error: ANDROID_HOME is not set${NC}"
    echo "Please run: source ~/.bashrc"
    exit 1
fi

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo -e "${RED}Error: Android Command Line Tools not found${NC}"
    echo "Please run setup-android-wsl.sh first"
    exit 1
fi

echo -e "${GREEN}ANDROID_HOME: $ANDROID_HOME${NC}"
echo ""

# sdkmanagerのパス
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"

# 1. ライセンスの同意
echo -e "${GREEN}[1/5] Accepting Android SDK licenses...${NC}"
yes | $SDKMANAGER --licenses || true
echo ""

# 2. プラットフォームツールのインストール
echo -e "${GREEN}[2/5] Installing platform-tools...${NC}"
$SDKMANAGER "platform-tools"
echo ""

# 3. ビルドツールとプラットフォームのインストール
echo -e "${GREEN}[3/5] Installing build-tools and platforms...${NC}"
$SDKMANAGER "build-tools;34.0.0"
$SDKMANAGER "platforms;android-34"
$SDKMANAGER "platforms;android-33"
echo ""

# 4. エミュレータのインストール
echo -e "${GREEN}[4/5] Installing emulator...${NC}"
$SDKMANAGER "emulator"
echo ""

# 5. システムイメージのインストール（x86_64）
echo -e "${GREEN}[5/5] Installing system images...${NC}"
echo -e "${YELLOW}This may take a while (downloading ~1GB)...${NC}"
$SDKMANAGER "system-images;android-34;google_apis;x86_64"
echo ""

# インストール完了確認
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Package installation completed!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# インストールされたパッケージの一覧
echo -e "${YELLOW}Installed packages:${NC}"
$SDKMANAGER --list_installed
echo ""

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "1. Create an Android Virtual Device (AVD):"
echo "   bash scripts/create-avd.sh"
echo ""
echo -e "${GREEN}Installation completed successfully!${NC}"
