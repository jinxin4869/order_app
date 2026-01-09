#!/bin/bash

# Android Emulator 起動スクリプト
# このスクリプトは、作成したAVDを起動します

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

EMULATOR="$ANDROID_HOME/emulator/emulator"

if [ ! -f "$EMULATOR" ]; then
    echo -e "${RED}Error: emulator not found at $EMULATOR${NC}"
    echo "Please run install-android-packages.sh first"
    exit 1
fi

# AVD名（デフォルト）
AVD_NAME="${1:-ExpoTestDevice}"

# AVDの存在確認
AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
if ! $AVDMANAGER list avd | grep -q "Name: $AVD_NAME"; then
    echo -e "${RED}Error: AVD '$AVD_NAME' not found${NC}"
    echo ""
    echo "Available AVDs:"
    $AVDMANAGER list avd
    echo ""
    echo "Please run: bash scripts/create-avd.sh"
    exit 1
fi

# 既に起動中のエミュレータを確認
if [ -f "$ANDROID_HOME/platform-tools/adb" ]; then
    RUNNING_DEVICES=$($ANDROID_HOME/platform-tools/adb devices | grep "emulator" || true)
    if [ -n "$RUNNING_DEVICES" ]; then
        echo -e "${YELLOW}Warning: An emulator is already running:${NC}"
        echo "$RUNNING_DEVICES"
        echo ""
        read -p "Continue starting another emulator? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled."
            exit 0
        fi
    fi
fi

echo -e "${GREEN}Starting Android Emulator: $AVD_NAME${NC}"
echo -e "${YELLOW}This may take a few minutes on first launch...${NC}"
echo ""
echo -e "${YELLOW}Tips:${NC}"
echo "  - The emulator will run in the background"
echo "  - Check status with: adb devices"
echo "  - Stop with: adb emu kill"
echo ""

# エミュレータを起動（バックグラウンドで）
# WSL環境での推奨オプション:
#   -no-snapshot-load: スナップショットを使わない（安定性向上）
#   -gpu swiftshader_indirect: WSLでのGPUエミュレーション
#   -no-audio: オーディオを無効化（WSLでは不要）

echo -e "${YELLOW}Starting emulator with WSL-optimized settings...${NC}"
$EMULATOR -avd "$AVD_NAME" \
    -gpu swiftshader_indirect \
    -no-audio \
    -no-snapshot-load \
    -no-boot-anim \
    > /tmp/emulator.log 2>&1 &

EMULATOR_PID=$!
echo -e "${GREEN}Emulator started with PID: $EMULATOR_PID${NC}"
echo ""

# エミュレータの起動を待機
echo -e "${YELLOW}Waiting for emulator to boot...${NC}"
sleep 5

# adbでデバイスを確認
if [ -f "$ANDROID_HOME/platform-tools/adb" ]; then
    ADB="$ANDROID_HOME/platform-tools/adb"

    # 最大60秒待機
    for i in {1..12}; do
        if $ADB devices | grep -q "emulator.*device"; then
            echo -e "${GREEN}Emulator is ready!${NC}"
            echo ""
            $ADB devices
            echo ""
            echo -e "${GREEN}=====================================${NC}"
            echo -e "${GREEN}Emulator started successfully!${NC}"
            echo -e "${GREEN}=====================================${NC}"
            echo ""
            echo -e "${YELLOW}Next: Start Expo and press 'a' to open on Android${NC}"
            echo "  npm start"
            echo ""
            echo "Emulator logs: tail -f /tmp/emulator.log"
            exit 0
        fi
        echo "  Waiting... ($i/12)"
        sleep 5
    done

    echo -e "${YELLOW}Emulator is starting but not fully booted yet.${NC}"
    echo "This is normal on first launch. Check status with:"
    echo "  adb devices"
    echo ""
    echo "Emulator logs: tail -f /tmp/emulator.log"
else
    echo -e "${YELLOW}adb not found. Cannot verify emulator status.${NC}"
    echo "Emulator logs: tail -f /tmp/emulator.log"
fi
