// QRコードスキャン画面
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { COLORS, FONT_SIZES } from "../constants";
import { validateQRCode } from "../services/api";

const QRScannerScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || isValidating) return;

    setScanned(true);
    setIsValidating(true);

    try {
      // QRコードデータをパース（format: restaurantId/tableId）
      const parts = data.split("/");

      if (parts.length !== 2) {
        Alert.alert("エラー", "無効なQRコードです。\nInvalid QR code.", [
          { text: "OK", onPress: () => setScanned(false) },
        ]);
        setIsValidating(false);
        return;
      }

      const [restaurantId, tableId] = parts;

      // Cloud Functionsで検証
      const result = await validateQRCode(data);

      if (result.valid) {
        // 言語選択画面に遷移
        navigation.navigate("LanguageSelect", {
          restaurantId,
          tableId,
          restaurant: result.restaurant,
          table: result.table,
        });
      } else {
        Alert.alert(
          "エラー",
          result.error || "テーブルが見つかりません。\nTable not found.",
          [{ text: "OK", onPress: () => setScanned(false) }]
        );
      }
    } catch (error) {
      console.error("QR validation error:", error);
      Alert.alert(
        "エラー",
        "接続エラーが発生しました。\nConnection error occurred.",
        [{ text: "OK", onPress: () => setScanned(false) }]
      );
    } finally {
      setIsValidating(false);
    }
  };

  // デバッグ用：スキャンをスキップする関数
  const handleDebugSkip = () => {
    // サンプルデータを使用して次の画面へ遷移
    navigation.navigate("LanguageSelect", {
      restaurantId: "restaurant_01",
      tableId: "table_01",
      restaurant: {
        id: "restaurant_01",
        name: "居酒屋さくら (Demo)",
        default_language: "ja",
        supported_languages: ["ja", "en", "zh"],
      },
      table: {
        id: "table_01",
        table_number: "1",
      },
    });
  };

  // 権限リクエスト中
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.messageText}>
          カメラ権限をリクエスト中...{"\n"}
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  // 権限拒否
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>📷</Text>
        <Text style={styles.messageText}>
          カメラへのアクセスが必要です{"\n"}
          Camera access is required
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>権限を許可 / Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />

      {/* スキャンガイド */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.instructionText}>
            テーブルのQRコードをスキャンしてください{"\n"}
            Scan the QR code on your table
          </Text>
        </View>
      </View>

      {/* ローディング表示 */}
      {isValidating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.surface} />
          <Text style={styles.loadingText}>確認中... / Validating...</Text>
        </View>
      )}

      {/* 再スキャンボタン */}
      {scanned && !isValidating && (
        <TouchableOpacity
          style={styles.rescanButton}
          onPress={() => setScanned(false)}
        >
          <Text style={styles.rescanButtonText}>再スキャン / Scan Again</Text>
        </TouchableOpacity>
      )}

      {/* デバッグ用スキップボタン */}
      <TouchableOpacity style={styles.debugButton} onPress={handleDebugSkip}>
        <Text style={styles.debugButtonText}>[Debug] Skip Scan</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.text,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 20,
  },
  messageText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 28,
  },
  errorText: {
    fontSize: 60,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 30,
  },
  buttonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayMiddle: {
    flexDirection: "row",
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scanArea: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: COLORS.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  instructionText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    textAlign: "center",
    lineHeight: 28,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    marginTop: 15,
  },
  rescanButton: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  rescanButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
  debugButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 8,
  },
  debugButtonText: {
    color: "#00ff00",
    fontSize: 12,
    fontWeight: "bold",
  },
});

export default QRScannerScreen;
