#!/bin/bash

# Expo を Windows 側の Android エミュレータで起動するスクリプト

echo "======================================"
echo "Starting Expo with Windows ADB"
echo "======================================"
echo ""

# Windows側のADBパス
WINDOWS_ADB="/mnt/c/Users/jinxi/AppData/Local/Android/Sdk/platform-tools/adb.exe"
WINDOWS_ANDROID_HOME="/mnt/c/Users/jinxi/AppData/Local/Android/Sdk"

# Windows ADBが存在するか確認
if [ ! -f "$WINDOWS_ADB" ]; then
    echo "Error: Windows ADB not found at $WINDOWS_ADB"
    exit 1
fi

# デバイスが接続されているか確認
echo "Checking for connected devices..."
$WINDOWS_ADB devices

DEVICE_COUNT=$($WINDOWS_ADB devices | tr -d '\r' | grep -E "emulator.*device|device.*device" | wc -l)

if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo ""
    echo "Error: No Android devices/emulators connected!"
    echo ""
    echo "Please start an emulator from Android Studio AVD Manager first."
    exit 1
fi

echo ""
echo "Found $DEVICE_COUNT device(s). Starting Expo..."
echo ""

# Windows側のANDROID_HOMEを使ってExpoを起動
export ANDROID_HOME="$WINDOWS_ANDROID_HOME"
export ANDROID_SDK_ROOT="$WINDOWS_ANDROID_HOME"

# ADB wrapper をPATHの最初に追加（Expoがadbを見つけられるように）
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$PROJECT_ROOT/.bin:$PATH"

echo "Using ADB from: $(which adb)"
echo ""

# Expoを起動
npm start
