// 注文履歴画面：この端末が来店中に送った注文と進行状況を表示する
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES } from "../constants";
import { useLanguage } from "../hooks/useLanguage";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { CartContext } from "../context/CartContext";
import { listVisitOrders } from "../services/api";

const REFRESH_MS = 15000;
const STATUS = {
  pending: ["受付待ち", "Waiting for confirmation", "等待确认"],
  confirmed: ["受付済み", "Confirmed", "已确认"],
  preparing: ["調理中", "Preparing", "制作中"],
  ready: ["まもなくお届けします", "Almost ready", "即将上菜"],
  served: ["お届け済み", "Served", "已上菜"],
  completed: ["完了", "Completed", "已完成"],
  cancelled: ["キャンセル", "Cancelled", "已取消"],
};
const LANGUAGE_INDEX = { ja: 0, en: 1, zh: 2 };

const OrderHistoryScreen = ({ navigation, route }) => {
  const { restaurantId, tableId, table } = route.params;
  const { currentLanguage } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const { getVisit, startNewVisit } = useContext(CartContext);
  const [orders, setOrders] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [ended, setEnded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const request = useRef(0);
  const index = LANGUAGE_INDEX[currentLanguage] ?? 0;
  const t = (ja, en, zh) => [ja, en, zh][index];

  const load = useCallback(async () => {
    const current = ++request.current;
    try {
      const { visitId } = await getVisit();
      const result = await listVisitOrders({ restaurantId, tableId, visitId });
      if (current !== request.current) return;
      setOrders(result.orders);
      // The previous visit at this table ended; later orders start a new one.
      setEnded((was) => was || (result.closed && !result.orders.length));
      if (result.closed && !result.orders.length) startNewVisit();
      setUpdatedAt(Date.now());
      setState("ready");
    } catch {
      if (current === request.current) setState("error");
    }
  }, [getVisit, startNewVisit, restaurantId, tableId]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    const reload = () => loadRef.current();
    reload();
    const timer = setInterval(reload, REFRESH_MS);
    const unfocus = navigation.addListener?.("focus", reload);
    const requests = request;
    return () => {
      clearInterval(timer);
      unfocus?.();
      requests.current++;
    };
  }, [navigation]);

  const itemName = (item) =>
    (currentLanguage !== "ja" && item[`name_${currentLanguage}`]) ||
    item.name_ja;
  const time = (millis) =>
    millis
      ? new Date(millis).toLocaleTimeString(
          { ja: "ja-JP", en: "en-US", zh: "zh-CN" }[currentLanguage] || "ja-JP",
          { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }
        )
      : "";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("戻る", "Back", "返回")}
          style={styles.back}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.grow}>
          <Text style={styles.title}>
            {t("注文履歴", "Your orders", "订单记录")}
          </Text>
          <Text style={styles.muted}>
            Table {table?.table_number || tableId}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.refresh}
          onPress={load}
        >
          <Text style={styles.refreshText}>{t("更新", "Refresh", "刷新")}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.muted}>
          {t(
            "この端末から送った注文だけを表示します。",
            "Only orders sent from this device are shown.",
            "仅显示从本设备提交的订单。"
          )}
          {updatedAt
            ? ` ${t("最終更新", "Updated", "更新于")} ${time(updatedAt)}`
            : ""}
        </Text>
        {(!isOnline || state === "error") && (
          <Text accessibilityRole="alert" style={styles.warning}>
            {t(
              "注文履歴を取得できません。表示中の内容は最新ではない可能性があります。",
              "Could not load your orders. What is shown may be out of date.",
              "无法获取订单记录。显示的内容可能不是最新的。"
            )}
          </Text>
        )}
        {ended && (
          <Text style={styles.muted}>
            {t(
              "前回のご来店は終了しました。",
              "Your previous visit has ended.",
              "上次的用餐已结束。"
            )}
          </Text>
        )}
        {state === "loading" && (
          <ActivityIndicator
            color={COLORS.primary}
            accessibilityLabel={t("読み込み中", "Loading", "加载中")}
          />
        )}
        {state !== "loading" && !orders.length && state !== "error" && (
          <Text style={styles.empty}>
            {t(
              "この端末から送った注文はまだありません。",
              "No orders from this device yet.",
              "本设备尚未提交订单。"
            )}
          </Text>
        )}
        {orders.map((order) => (
          <View key={order.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.number}>{order.order_number}</Text>
              <Text style={styles.status}>
                {(STATUS[order.status] || [order.status])[index] ||
                  order.status}
              </Text>
            </View>
            <Text style={styles.muted}>{time(order.created_at)}</Text>
            {order.items.map((item, position) => (
              <Text key={position} style={styles.item}>
                {itemName(item)} × {item.quantity}
              </Text>
            ))}
            <Text style={styles.total}>
              {t("合計（税込）", "Total (incl. tax)", "合计（含税）")} ¥
              {Number(order.total_amount || 0).toLocaleString("ja-JP")}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  grow: { flex: 1 },
  back: { minWidth: 44, minHeight: 44, justifyContent: "center" },
  backText: { fontSize: FONT_SIZES.xl, color: COLORS.text },
  title: { fontSize: FONT_SIZES.lg, fontWeight: "700", color: COLORS.text },
  refresh: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  refreshText: { color: COLORS.text, fontWeight: "600" },
  content: { padding: 16, gap: 12 },
  muted: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  warning: { color: "#8A3B00", fontSize: FONT_SIZES.md, lineHeight: 22 },
  empty: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  card: {
    padding: 14,
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  number: { fontSize: FONT_SIZES.lg, fontWeight: "700", color: COLORS.text },
  status: { fontSize: FONT_SIZES.md, fontWeight: "700", color: "#B71C1C" },
  item: { fontSize: FONT_SIZES.md, color: COLORS.text },
  total: { fontSize: FONT_SIZES.md, fontWeight: "700", color: COLORS.text },
});

export default OrderHistoryScreen;
