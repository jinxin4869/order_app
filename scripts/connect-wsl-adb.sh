#!/bin/bash

# WSL と Windows の ADB を連携させるスクリプト
# Windows側のエミュレータをWSL側から使用できるようにします

set -e

echo "======================================"
echo "Connecting WSL ADB to Windows ADB"
echo "======================================"
echo ""

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# WSL側のADBサーバーを停止
echo -e "${YELLOW}Stopping WSL ADB server...${NC}"
if [ -f "$ANDROID_HOME/platform-tools/adb" ]; then
    $ANDROID_HOME/platform-tools/adb kill-server 2>/dev/null || true
fi

# Windows側のADBパス
WINDOWS_ADB="/mnt/c/Users/jinxi/AppData/Local/Android/Sdk/platform-tools/adb.exe"

if [ ! -f "$WINDOWS_ADB" ]; then
    echo -e "${RED}Error: Windows ADB not found at $WINDOWS_ADB${NC}"
    exit 1
fi

# Windows側のADBサーバーを起動
echo -e "${YELLOW}Starting Windows ADB server...${NC}"
$WINDOWS_ADB start-server

# Windows側のデバイスを確認
echo ""
echo -e "${GREEN}Connected devices (via Windows ADB):${NC}"
$WINDOWS_ADB devices

# デバイスが接続されているか確認
DEVICE_COUNT=$($WINDOWS_ADB devices | grep -v "List of devices" | grep -v "^$" | grep "device$" | wc -l)

if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo ""
    echo -e "${RED}No devices connected!${NC}"
    echo ""
    echo "Please ensure an Android emulator is running."
    echo "Start emulator from Android Studio AVD Manager."
    exit 1
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}ADB connection configured!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${YELLOW}You can now use Windows ADB from WSL:${NC}"
echo "  $WINDOWS_ADB devices"
echo ""
echo -e "${YELLOW}Or create an alias in your shell:${NC}"
echo "  alias adb='$WINDOWS_ADB'"
echo ""
echo -e "${GREEN}Ready to start Expo!${NC}"
echo "  npm start"
echo "  # Press 'a' to open on Android"
