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
import { useResponsive } from "../hooks/useResponsive";

const OrderCompleteScreen = ({ navigation, route }) => {
  const { orderId, orderNumber, restaurant, table } = route.params;
  const { currentLanguage } = useLanguage();
  const { isSmallScreen, scaleSize } = useResponsive();

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
  // React Navigation 7 の navigate は既存の Menu に戻らず新しく積むため、popTo で戻る。
  const handleNewOrder = () => {
    navigation.popTo("Menu", {
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

  // レスポンシブなサイズ
  const iconContainerSize = scaleSize(100, 80, 110);
  const orderNumberFontSize = scaleSize(36, 28, 40);

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.content, isSmallScreen && styles.contentSmall]}>
        {/* 成功アイコン */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              width: iconContainerSize,
              height: iconContainerSize,
              borderRadius: iconContainerSize / 2,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text
            style={[styles.successIcon, { fontSize: scaleSize(50, 40, 55) }]}
          >
            ✓
          </Text>
        </Animated.View>

        {/* メッセージ */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text
            style={[styles.title, isSmallScreen && styles.titleSmall]}
            adjustsFontSizeToFit
            numberOfLines={2}
          >
            {t(
              "ご注文ありがとうございます！",
              "Thank you for your order!",
              "感谢您的订购！"
            )}
          </Text>

          <Text
            style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}
          >
            {t(
              "ご注文を受け付けました",
              "Your order has been received",
              "您的订单已收到"
            )}
          </Text>

          {/* 注文番号 */}
          <View
            style={[
              styles.orderInfoCard,
              isSmallScreen && styles.orderInfoCardSmall,
            ]}
          >
            <Text
              style={[
                styles.orderLabel,
                isSmallScreen && styles.orderLabelSmall,
              ]}
            >
              {t("注文番号", "Order Number", "订单号")}
            </Text>
            <Text
              style={[styles.orderNumber, { fontSize: orderNumberFontSize }]}
            >
              {orderNumber || orderId?.slice(-6).toUpperCase()}
            </Text>
          </View>

          {/* 注文詳細 */}
          <View
            style={[
              styles.detailsContainer,
              isSmallScreen && styles.detailsContainerSmall,
            ]}
          >
            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  isSmallScreen && styles.detailLabelSmall,
                ]}
              >
                {t("店舗", "Restaurant", "餐厅")}
              </Text>
              <Text
                style={[
                  styles.detailValue,
                  isSmallScreen && styles.detailValueSmall,
                ]}
                numberOfLines={1}
              >
                {restaurant?.name || "-"}
              </Text>
            </View>

            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text
                style={[
                  styles.detailLabel,
                  isSmallScreen && styles.detailLabelSmall,
                ]}
              >
                {t("テーブル", "Table", "桌号")}
              </Text>
              <Text
                style={[
                  styles.detailValue,
                  isSmallScreen && styles.detailValueSmall,
                ]}
              >
                {table?.table_number || "-"}
              </Text>
            </View>
          </View>

          {/* メッセージ */}
          <View
            style={[
              styles.messageContainer,
              isSmallScreen && styles.messageContainerSmall,
            ]}
          >
            <Text
              style={[styles.messageIcon, { fontSize: scaleSize(40, 32, 44) }]}
            >
              🍽️
            </Text>
            <Text
              style={[styles.message, isSmallScreen && styles.messageSmall]}
            >
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
      <View
        style={[
          styles.buttonContainer,
          isSmallScreen && styles.buttonContainerSmall,
        ]}
      >
        <TouchableOpacity
          style={[
            styles.primaryButton,
            isSmallScreen && styles.primaryButtonSmall,
          ]}
          onPress={handleNewOrder}
        >
          <Text
            style={[
              styles.primaryButtonText,
              isSmallScreen && styles.primaryButtonTextSmall,
            ]}
          >
            {t("追加注文する", "Add More Items", "继续点餐")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            isSmallScreen && styles.secondaryButtonSmall,
          ]}
          onPress={handleStartOver}
        >
          <Text
            style={[
              styles.secondaryButtonText,
              isSmallScreen && styles.secondaryButtonTextSmall,
            ]}
          >
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
  contentSmall: {
    padding: 20,
  },
  iconContainer: {
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
  titleSmall: {
    fontSize: FONT_SIZES.xl,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 30,
  },
  subtitleSmall: {
    fontSize: FONT_SIZES.sm,
    marginBottom: 20,
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
  orderInfoCardSmall: {
    padding: 15,
    marginBottom: 15,
  },
  orderLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  orderLabelSmall: {
    fontSize: FONT_SIZES.xs,
  },
  orderNumber: {
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
  detailsContainerSmall: {
    padding: 12,
    marginBottom: 15,
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
  detailLabelSmall: {
    fontSize: FONT_SIZES.sm,
  },
  detailValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
  },
  detailValueSmall: {
    fontSize: FONT_SIZES.sm,
  },
  messageContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  messageContainerSmall: {
    paddingHorizontal: 10,
  },
  messageIcon: {
    marginBottom: 10,
  },
  message: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  messageSmall: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 20,
    gap: 12,
  },
  buttonContainerSmall: {
    padding: 15,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
  },
  primaryButtonSmall: {
    padding: 12,
  },
  primaryButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
  },
  primaryButtonTextSmall: {
    fontSize: FONT_SIZES.md,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonSmall: {
    padding: 12,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: "500",
  },
  secondaryButtonTextSmall: {
    fontSize: FONT_SIZES.sm,
  },
});

export default OrderCompleteScreen;
