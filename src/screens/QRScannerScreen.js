// QRコードスキャン画面
/* global __DEV__ */
import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { COLORS, FONT_SIZES } from "../constants";
import { validateQRCode } from "../services/api";
import { showAlert } from "../utils/dialogs";
import { parseOrderLink, qrRefusal } from "../utils/orderLinks";
import { useResponsive } from "../hooks/useResponsive";

// デモ用の入口は開発ビルドだけで読み込む。本番ビルドでは __DEV__ が false に
// 置き換わり、この require ごとバンドルから除かれる。
const DemoEntry = __DEV__ ? require("./DemoEntry").default : null;

const QRScannerScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const { width, isSmallScreen, scaleSize } = useResponsive();

  // レスポンシブなスキャンエリアサイズ
  const scanAreaSize = Math.min(scaleSize(250, 180, 280), width * 0.7);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || isValidating) return;

    setScanned(true);
    setIsValidating(true);

    try {
      // QRコードデータをパース（format: restaurantId/tableId）
      const session = parseOrderLink(data);

      if (!session) {
        showAlert(
          "エラー / Error / 错误",
          "無効なQRコードです。\nInvalid QR code.\n无效的二维码。",
          [{ text: "OK", onPress: () => setScanned(false) }]
        );
        setIsValidating(false);
        return;
      }

      const { restaurantId, tableId, token } = session;

      // Cloud Functionsで検証
      const result = await validateQRCode(
        token
          ? `${restaurantId}/${tableId}/${token}`
          : `${restaurantId}/${tableId}`
      );

      if (result.valid) {
        // 言語選択画面に遷移
        navigation.navigate("LanguageSelect", {
          restaurantId,
          tableId,
          restaurant: result.restaurant,
          table: token ? { ...result.table, token } : result.table,
        });
      } else {
        showAlert(
          "エラー / Error / 错误",
          qrRefusal(result.reason).join("\n"),
          [{ text: "OK", onPress: () => setScanned(false) }]
        );
      }
    } catch (error) {
      console.error("QR validation error:", error);
      showAlert(
        "エラー / Error / 错误",
        "接続エラーが発生しました。\nConnection error occurred.\n连接出错。",
        [{ text: "OK", onPress: () => setScanned(false) }]
      );
    } finally {
      setIsValidating(false);
    }
  };

  // 権限リクエスト中
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text
          style={[styles.messageText, isSmallScreen && styles.messageTextSmall]}
        >
          カメラ権限をリクエスト中...{"\n"}
          Requesting camera permission...{"\n"}
          正在请求相机权限...
        </Text>
      </View>
    );
  }

  // 権限拒否
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorText, { fontSize: scaleSize(60, 48, 60) }]}>
          📷
        </Text>
        <Text
          style={[styles.messageText, isSmallScreen && styles.messageTextSmall]}
        >
          カメラへのアクセスが必要です{"\n"}
          Camera access is required{"\n"}
          需要访问相机
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text
            style={[styles.buttonText, isSmallScreen && styles.buttonTextSmall]}
          >
            権限を許可 / Grant Permission / 授予权限
          </Text>
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
          <View
            style={[
              styles.scanArea,
              { width: scanAreaSize, height: scanAreaSize },
            ]}
          >
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text
            style={[
              styles.instructionText,
              isSmallScreen && styles.instructionTextSmall,
            ]}
          >
            テーブルのQRコードをスキャンしてください{"\n"}
            Scan the QR code on your table{"\n"}
            请扫描桌上的二维码
          </Text>
        </View>
      </View>

      {/* ローディング表示 */}
      {isValidating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.surface} />
          <Text style={styles.loadingText}>
            確認中... / Validating... / 验证中...
          </Text>
        </View>
      )}

      {/* 再スキャンボタン */}
      {scanned && !isValidating && (
        <TouchableOpacity
          style={[
            styles.rescanButton,
            isSmallScreen && styles.rescanButtonSmall,
          ]}
          onPress={() => setScanned(false)}
        >
          <Text
            style={[
              styles.rescanButtonText,
              isSmallScreen && styles.rescanButtonTextSmall,
            ]}
          >
            再スキャン / Scan Again / 重新扫描
          </Text>
        </TouchableOpacity>
      )}

      {/* デモ用の入口（開発ビルドのみ） */}
      {__DEV__ && <DemoEntry navigation={navigation} />}
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
  messageTextSmall: {
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
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
  buttonTextSmall: {
    fontSize: FONT_SIZES.sm,
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
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 25,
    height: 25,
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
  instructionTextSmall: {
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
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
  rescanButtonSmall: {
    bottom: 40,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rescanButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
  rescanButtonTextSmall: {
    fontSize: FONT_SIZES.sm,
  },
});

export default QRScannerScreen;
