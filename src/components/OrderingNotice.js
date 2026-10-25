// 注文受付の一時停止と、販売状態を確認できないことを知らせる。
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../constants";
import { useLanguage } from "../hooks/useLanguage";

const OrderingNotice = ({ availability }) => {
  const { currentLanguage } = useLanguage();
  const t = (ja, en, zh) =>
    currentLanguage === "zh" ? zh : currentLanguage === "en" ? en : ja;
  const messages = [];
  if (availability.ordering === "paused")
    messages.push(
      t(
        "現在、注文受付を一時停止しています。スタッフへお声がけください。",
        "We are not taking new orders right now. Please ask our staff.",
        "目前暂停接受新订单。请联系店员。"
      )
    );
  if (availability.ordering === "invalid")
    messages.push(
      t(
        "現在、注文を受け付けられません。スタッフへお声がけください。",
        "Orders cannot be placed right now. Please ask our staff.",
        "目前无法下单。请联系店员。"
      )
    );
  const stale = availability.failed;
  if (!messages.length && !stale) return null;
  const checked = availability.updatedAt
    ? new Date(availability.updatedAt).toLocaleTimeString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <View accessibilityLiveRegion="polite" style={styles.box}>
      {messages.map((message) => (
        <Text key={message} style={styles.text}>
          {message}
        </Text>
      ))}
      {stale && (
        <View style={styles.row}>
          <Text style={[styles.text, styles.grow]}>
            {t(
              "販売状況を確認できません。表示が最新ではない可能性があります。",
              "Could not check availability. The display may be out of date.",
              "无法确认供应情况。显示可能不是最新的。"
            )}
            {checked ? ` (${checked})` : ""}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={availability.refresh}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {t("再確認", "Check again", "重新确认")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.warning,
    backgroundColor: COLORS.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1 },
  text: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonText: { color: COLORS.text, fontWeight: "700" },
});

export default OrderingNotice;
