// 送信結果が不明だった注文の受付状況を知らせ、復旧の操作を案内する。
import React, { useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../constants";
import { CartContext } from "../context/CartContext";
import { useLanguage } from "../hooks/useLanguage";

// `session` is the current route's { restaurantId, tableId, restaurant, table }.
const PendingOrderNotice = ({ navigation, session }) => {
  const { recovery, retryRecovery, restoreRecoveredOrder, dismissRecovery } =
    useContext(CartContext) || {};
  const { currentLanguage } = useLanguage();
  if (!recovery) return null;
  const t = (ja, en, zh) =>
    currentLanguage === "zh" ? zh : currentLanguage === "en" ? en : ja;
  const number = recovery.result?.orderNumber;
  const message = {
    checking: t(
      "前回の注文の受付状況を確認しています…",
      "Checking whether your last order was received…",
      "正在确认上次的订单是否已受理…"
    ),
    accepted: t(
      `前回の注文は受け付けられています（注文番号 ${number}）。`,
      `Your last order was received (order ${number}).`,
      `上次的订单已受理（订单号 ${number}）。`
    ),
    not_accepted: t(
      "前回の注文は受け付けられていません。",
      "Your last order was not received.",
      "上次的订单未被受理。"
    ),
    error: t(
      "前回の注文の受付状況を確認できません。通信を確認してください。",
      "Could not check your last order. Check your connection.",
      "无法确认上次的订单。请检查网络连接。"
    ),
  }[recovery.state];
  const actions =
    {
      accepted: [
        [
          t("注文内容を見る", "View order", "查看订单"),
          () => {
            navigation.navigate("OrderComplete", {
              ...session,
              orderId: recovery.result.orderId,
              orderNumber: recovery.result.orderNumber,
              total: recovery.payload.totalAmount,
            });
            dismissRecovery();
          },
        ],
      ],
      not_accepted: [
        [
          t("カートに戻す", "Put back in cart", "放回购物车"),
          restoreRecoveredOrder,
        ],
        [t("破棄する", "Discard", "放弃"), dismissRecovery],
      ],
      error: [
        [t("もう一度確認する", "Check again", "再次确认"), retryRecovery],
      ],
    }[recovery.state] || [];
  return (
    <View accessibilityLiveRegion="polite" style={styles.box}>
      <Text style={styles.text}>{message}</Text>
      {!!actions.length && (
        <View style={styles.actions}>
          {actions.map(([label, onPress]) => (
            <TouchableOpacity
              key={label}
              accessibilityRole="button"
              onPress={onPress}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    margin: 12,
    padding: 12,
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.warning,
    backgroundColor: COLORS.surface,
  },
  text: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 8,
    // Darker than COLORS.primary so white text keeps a 4.5:1 contrast.
    backgroundColor: "#B71C1C",
  },
  buttonText: { color: COLORS.surface, fontWeight: "700" },
});

export default PendingOrderNotice;
