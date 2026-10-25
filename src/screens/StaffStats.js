// スタッフ向けの日次集計：注文数・商品数量・人気商品・提供までの時間。
// 会計上の売上ではなく、注文の実績と対応時間を表示する。
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { COLORS } from "../constants";
import { getDailyStats } from "../services/api";
import { businessDay } from "../../functions/src/utils/businessDay";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateOf = (day) =>
  new Date(
    `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}T00:00:00+09:00`
  );
const shift = (day, days) =>
  businessDay(new Date(dateOf(day).getTime() + days * DAY_MS));
const dayLabel = (day) =>
  `${day.slice(0, 4)}年${Number(day.slice(4, 6))}月${Number(day.slice(6))}日`;
const timeLabel = (millis) =>
  new Date(millis).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
const durationLabel = (label, value) =>
  value.count
    ? `${label}：中央値 ${value.medianMinutes}分（平均 ${value.averageMinutes}分、${value.count}件${value.missing ? `、時刻の記録なし ${value.missing}件` : ""}）`
    : `${label}：記録がありません${value.missing ? `（時刻の記録なし ${value.missing}件）` : ""}`;

const Button = ({ label, onPress, disabled }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    onPress={onPress}
    style={[styles.button, disabled && styles.disabled]}
  >
    <Text style={styles.text}>{label}</Text>
  </Pressable>
);

const StaffStats = () => {
  const today = businessDay();
  const [day, setDay] = useState(today);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("loading");
  const request = useRef(0);
  const load = useCallback(async (target) => {
    const current = ++request.current;
    setStatus("loading");
    try {
      const result = await getDailyStats(target);
      if (current !== request.current) return;
      setStats(result);
      setStatus("ready");
    } catch {
      if (current === request.current) setStatus("error");
    }
  }, []);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current(day);
  }, [day]);
  const shown = stats?.day === day ? stats : null;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Button label="前日" onPress={() => setDay(shift(day, -1))} />
        <Text style={[styles.title, styles.grow]}>{dayLabel(day)}</Text>
        <Button
          label="翌日"
          disabled={day >= today}
          onPress={() => setDay(shift(day, 1))}
        />
        <Button label="更新" onPress={() => load(day)} />
      </View>
      <Text style={styles.muted}>
        日本時間0時で区切り、注文した営業日に数えます（0時をまたいで提供した注文も注文日に含めます）。キャンセルした注文は数えず、数量は訂正後の値です。会計上の売上ではありません。
      </Text>
      {status === "loading" && !shown && (
        <ActivityIndicator color={COLORS.primary} accessibilityLabel="集計中" />
      )}
      {status === "error" && (
        <Text accessibilityRole="alert" style={styles.error}>
          集計できません。接続を確認して「更新」を押してください。
        </Text>
      )}
      {shown && (
        <>
          <Text style={styles.muted}>
            集計時刻 {timeLabel(shown.generatedAt)}
          </Text>
          {shown.truncated && (
            <Text accessibilityRole="alert" style={styles.error}>
              注文が多いため、最初の2,000件だけを集計しています。
            </Text>
          )}
          {!shown.orders.total ? (
            <Text style={styles.text}>この日の注文はありません。</Text>
          ) : (
            <>
              <View style={styles.box}>
                <Text style={styles.metric}>注文 {shown.orders.active}件</Text>
                <Text style={styles.muted}>
                  受付 {shown.orders.total}件（キャンセル{" "}
                  {shown.orders.cancelled}件、訂正あり {shown.orders.corrected}
                  件）
                </Text>
                <Text style={styles.metric}>商品 {shown.itemQuantity}点</Text>
              </View>
              <View style={styles.box}>
                <Text style={styles.title}>人気の商品</Text>
                {shown.popular.map((item, index) => (
                  <Text key={item.item_id} style={styles.text}>
                    {index + 1}. {item.name_ja} — {item.quantity}点（
                    {item.orders}件の注文）
                  </Text>
                ))}
              </View>
              <View style={styles.box}>
                <Text style={styles.title}>
                  提供までの時間（提供済み {shown.orders.served}件）
                </Text>
                <Text style={styles.text}>
                  {durationLabel("注文から提供", shown.durations.orderToServed)}
                </Text>
                <Text style={styles.text}>
                  {durationLabel(
                    "受付から提供",
                    shown.durations.confirmedToServed
                  )}
                </Text>
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12, paddingBottom: 32 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  grow: { flex: 1, minWidth: 140 },
  box: {
    padding: 12,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  metric: { fontSize: 22, fontWeight: "700", color: COLORS.text },
  text: { fontSize: 16, color: COLORS.text, lineHeight: 24 },
  muted: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  error: { fontSize: 16, color: "#B71C1C" },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  disabled: { opacity: 0.5 },
});

export default StaffStats;
