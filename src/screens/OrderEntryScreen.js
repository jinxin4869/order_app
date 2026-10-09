import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants";
import { validateQRCode } from "../services/api";
import { parseOrderLink } from "../utils/orderLinks";

export default function OrderEntryScreen({ navigation, route }) {
  const restaurantId = route.params?.restaurant;
  const tableId = route.params?.table;
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState(null);
  const key = `${restaurantId || ""}/${tableId || ""}/${attempt}`;
  const session = parseOrderLink(`${restaurantId || ""}/${tableId || ""}`);
  const error = !session
    ? "無効なテーブルURLです。 / Invalid table link. / 餐桌链接无效。"
    : failure?.key === key
      ? failure.message
      : "";
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    const currentSession = parseOrderLink(
      `${restaurantId || ""}/${tableId || ""}`
    );
    if (!currentSession) return;
    const validate = async () => {
      try {
        const result = await validateQRCode(
          `${currentSession.restaurantId}/${currentSession.tableId}`
        );
        if (!active) return;
        if (!result.valid) {
          setFailure({
            key,
            message:
              result.error ||
              "このテーブルは利用できません。 / Table unavailable. / 餐桌不可用。",
          });
          return;
        }
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "LanguageSelect",
              params: {
                ...currentSession,
                restaurant: result.restaurant,
                table: result.table,
              },
            },
          ],
        });
      } catch {
        if (active)
          setFailure({
            key,
            message:
              "接続できません。再試行してください。 / Connection failed. Please retry. / 连接失败，请重试。",
          });
      }
    };
    validate();
    return () => {
      active = false;
    };
  }, [restaurantId, tableId, key, navigation]);
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        {error ? (
          <>
            <Text accessibilityRole="alert" style={styles.message}>
              {error}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={retry}
              style={styles.button}
            >
              <Text style={styles.buttonText}>再試行 / Retry / 重试</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() =>
                navigation.reset({ index: 0, routes: [{ name: "QRScanner" }] })
              }
            >
              <Text style={styles.message}>
                QRを読み直す / Scan again / 重新扫描
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.message}>
              テーブルを確認しています… / Checking your table… / 正在确认餐桌…
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    padding: 24,
  },
  content: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 24 },
  message: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
    color: COLORS.text,
  },
  button: {
    minHeight: 48,
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 8,
  },
  buttonText: { color: COLORS.surface, fontSize: 16, textAlign: "center" },
});
