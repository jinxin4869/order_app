#!/bin/bash

# Android Virtual Device (AVD) 作成スクリプト
# このスクリプトは、Expo開発用のエミュレータを作成します

set -e

echo "======================================"
echo "Creating Android Virtual Device (AVD)"
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

AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"

if [ ! -f "$AVDMANAGER" ]; then
    echo -e "${RED}Error: avdmanager not found${NC}"
    echo "Please run install-android-packages.sh first"
    exit 1
fi

# AVD名
AVD_NAME="ExpoTestDevice"

# 既存のAVDを確認
echo -e "${YELLOW}Checking for existing AVDs...${NC}"
EXISTING_AVDS=$($AVDMANAGER list avd | grep "Name:" || true)
if echo "$EXISTING_AVDS" | grep -q "$AVD_NAME"; then
    echo -e "${YELLOW}AVD '$AVD_NAME' already exists.${NC}"
    read -p "Do you want to delete and recreate it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deleting existing AVD...${NC}"
        $AVDMANAGER delete avd -n "$AVD_NAME"
    else
        echo -e "${GREEN}Using existing AVD '$AVD_NAME'${NC}"
        echo ""
        echo -e "${YELLOW}========================================${NC}"
        echo -e "${YELLOW}AVD Information:${NC}"
        echo -e "${YELLOW}========================================${NC}"
        $AVDMANAGER list avd
        exit 0
    fi
fi

# AVDの作成
echo -e "${GREEN}Creating new AVD '$AVD_NAME'...${NC}"
echo no | $AVDMANAGER create avd \
    -n "$AVD_NAME" \
    -k "system-images;android-34;google_apis;x86_64" \
    --device "pixel_6"

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}AVD created successfully!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# AVD設定の最適化（config.iniの編集）
AVD_CONFIG="$HOME/.android/avd/${AVD_NAME}.avd/config.ini"
if [ -f "$AVD_CONFIG" ]; then
    echo -e "${YELLOW}Optimizing AVD configuration...${NC}"

    # メモリ設定を追加/更新
    if grep -q "hw.ramSize" "$AVD_CONFIG"; then
        sed -i 's/hw.ramSize=.*/hw.ramSize=2048/' "$AVD_CONFIG"
    else
        echo "hw.ramSize=2048" >> "$AVD_CONFIG"
    fi

    # GPUエミュレーションを有効化
    if grep -q "hw.gpu.enabled" "$AVD_CONFIG"; then
        sed -i 's/hw.gpu.enabled=.*/hw.gpu.enabled=yes/' "$AVD_CONFIG"
    else
        echo "hw.gpu.enabled=yes" >> "$AVD_CONFIG"
    fi

    # ハードウェアキーボードを有効化
    if grep -q "hw.keyboard" "$AVD_CONFIG"; then
        sed -i 's/hw.keyboard=.*/hw.keyboard=yes/' "$AVD_CONFIG"
    else
        echo "hw.keyboard=yes" >> "$AVD_CONFIG"
    fi

    echo -e "${GREEN}AVD configuration optimized${NC}"
fi

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}AVD Information:${NC}"
echo -e "${YELLOW}========================================${NC}"
$AVDMANAGER list avd
echo ""

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "1. Start the emulator:"
echo "   bash scripts/start-emulator.sh"
echo ""
echo "   Or manually:"
echo "   \$ANDROID_HOME/emulator/emulator -avd $AVD_NAME"
echo ""
echo "2. In another terminal, start Expo:"
echo "   npm start"
echo "   # Then press 'a' to open on Android"
echo ""
echo -e "${GREEN}Setup completed successfully!${NC}"
