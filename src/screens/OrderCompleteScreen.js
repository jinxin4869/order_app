// 注文完了画面
import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES } from "../constants";
import { useLanguage } from "../hooks/useLanguage";

const OrderCompleteScreen = ({ navigation, route }) => {
  const { orderId, orderNumber, total, restaurant, table } = route.params;
  const { currentLanguage } = useLanguage();

  // アニメーション
  const scaleAnim = useMemo(() => new Animated.Value(0), []);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  // テキスト取得用ヘルパー
  const t = (ja, en, zh) => {
    if (currentLanguage === "zh") return zh;
    if (currentLanguage === "en") return en;
    return ja;
  };

  // 新しい注文を開始
  const handleNewOrder = () => {
    navigation.navigate("Menu", {
      restaurantId: route.params.restaurantId,
      tableId: route.params.tableId,
      restaurant,
      table,
    });
  };

  // 最初から始める
  const handleStartOver = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "QRScanner" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 成功アイコン */}
        <Animated.View
          style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}
        >
          <Text style={styles.successIcon}>✓</Text>
        </Animated.View>

        {/* メッセージ */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.title}>
            {t(
              "ご注文ありがとうございます！",
              "Thank you for your order!",
              "感谢您的订购！"
            )}
          </Text>

          <Text style={styles.subtitle}>
            {t(
              "ご注文を受け付けました",
              "Your order has been received",
              "您的订单已收到"
            )}
          </Text>

          {/* 注文番号 */}
          <View style={styles.orderInfoCard}>
            <Text style={styles.orderLabel}>
              {t("注文番号", "Order Number", "订单号")}
            </Text>
            <Text style={styles.orderNumber}>
              {orderNumber || orderId?.slice(-6).toUpperCase()}
            </Text>
          </View>

          {/* 注文詳細 */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {t("店舗", "Restaurant", "餐厅")}
              </Text>
              <Text style={styles.detailValue}>{restaurant?.name || "-"}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {t("テーブル", "Table", "桌号")}
              </Text>
              <Text style={styles.detailValue}>
                {table?.table_number || "-"}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {t("合計金額", "Total", "总计")}
              </Text>
              <Text style={styles.detailValuePrice}>
                ¥{total?.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* メッセージ */}
          <View style={styles.messageContainer}>
            <Text style={styles.messageIcon}>🍽️</Text>
            <Text style={styles.message}>
              {t(
                "お料理の準備ができましたらお届けします。\nしばらくお待ちください。",
                "Your food will be served when ready.\nPlease wait for a moment.",
                "您的食物准备好后会送到。\n请稍等片刻。"
              )}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* ボタン */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleNewOrder}>
          <Text style={styles.primaryButtonText}>
            {t("追加注文する", "Add More Items", "继续点餐")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleStartOver}
        >
          <Text style={styles.secondaryButtonText}>
            {t("終了する", "Finish", "结束")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.success,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successIcon: {
    fontSize: 50,
    color: COLORS.surface,
    fontWeight: "bold",
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 30,
  },
  orderInfoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  orderNumber: {
    fontSize: 36,
    fontWeight: "bold",
    color: COLORS.primary,
    letterSpacing: 3,
  },
  detailsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 15,
    width: "100%",
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: "500",
  },
  detailValuePrice: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    fontWeight: "bold",
  },
  messageContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  messageIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  message: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  buttonContainer: {
    padding: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: "500",
  },
});

export default OrderCompleteScreen;
