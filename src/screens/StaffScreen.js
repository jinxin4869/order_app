import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants";
import {
  STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
} from "../../functions/src/utils/orderStatus";
import {
  observeStaffSession,
  signInStaff,
  signOutStaff,
} from "../services/staffAuth";
import {
  listStaffOrders,
  getStaffOrder,
  updateOrderStatus,
} from "../services/api";
import { showAlert } from "../utils/dialogs";

const Action = ({ children, onPress, disabled, secondary = false }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.action,
      secondary && styles.secondary,
      disabled && styles.disabled,
      pressed && { opacity: 0.75 },
    ]}
  >
    <Text style={[styles.actionText, secondary && styles.secondaryText]}>
      {children}
    </Text>
  </Pressable>
);
const dateLabel = (millis) =>
  millis
    ? new Date(millis).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "時刻不明";
const money = (value) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;
const actionLabels = {
  confirmed: "注文を受け付ける",
  preparing: "調理を開始する",
  ready: "提供待ちにする",
  served: "提供済みにする",
  completed: "対応を完了する",
  cancelled: "注文をキャンセルする",
};

const OrderConsole = ({ session }) => {
  const wide = useWindowDimensions().width >= 900;
  const [view, setView] = useState("active");
  const [listing, setListing] = useState({
    orders: [],
    hasMore: false,
    cursor: null,
  });
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const generation = useRef(0);
  const loading = useRef(false);
  const seen = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const detailRequest = useRef(0);
  const updateLock = useRef(false);

  const refresh = useCallback(
    async ({ more = false, quiet = false } = {}) => {
      if (loading.current) return;
      loading.current = true;
      const current = generation.current;
      if (!quiet) setBusy(true);
      try {
        const result = await listStaffOrders({
          view,
          ...(more ? { cursor: listing.cursor } : {}),
        });
        if (current !== generation.current) return;
        if (!more) {
          if (seen.current) {
            const added = result.orders.filter(
              (order) => !seen.current.has(order.id)
            ).length;
            setNewCount((count) => count + added);
          }
          seen.current = new Set([
            ...(seen.current || []),
            ...result.orders.map((order) => order.id),
          ]);
        }
        setListing((previous) => ({
          ...result,
          orders: more
            ? [
                ...previous.orders,
                ...result.orders.filter(
                  (order) => !previous.orders.some((old) => old.id === order.id)
                ),
              ]
            : result.orders,
        }));
        setError("");
        setLastRefresh(Date.now());
      } catch (failure) {
        if (current === generation.current) {
          if (
            failure.code?.includes("permission-denied") ||
            failure.code?.includes("unauthenticated")
          ) {
            setListing({ orders: [], hasMore: false, cursor: null });
            detailRequest.current++;
            setSelectedId(null);
            setSelected(null);
          }
          setError(
            failure.code?.includes("permission-denied") ||
              failure.code?.includes("unauthenticated")
              ? "権限を確認できません。ログアウトして再ログインしてください。"
              : "注文を取得できません。接続を確認して「更新」を押してください。表示中の情報は最新ではありません。"
          );
        }
      } finally {
        if (current === generation.current) {
          loading.current = false;
          setBusy(false);
        }
      }
    },
    [view, listing.cursor]
  );
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    generation.current++;
    loading.current = false;
    seen.current = null;
    refreshRef.current();
    const lifetime = generation;
    const detailLifetime = detailRequest;
    const timer = setInterval(() => refreshRef.current({ quiet: true }), 15000);
    return () => {
      clearInterval(timer);
      lifetime.current++;
      detailLifetime.current++;
    };
  }, [view]);

  const openOrder = async (id) => {
    const request = ++detailRequest.current;
    setSelectedId(id);
    setSelected(null);
    setNotice("注文の詳細を取得しています…");
    try {
      const result = await getStaffOrder(id);
      if (request !== detailRequest.current) return;
      setSelected(result.order);
      setNotice("");
    } catch {
      if (request === detailRequest.current)
        setNotice("詳細を取得できません。注文を選び直してください。");
    }
  };
  const changeStatus = (newStatus) => {
    const order = selected;
    showAlert(
      "注文の状態を変更",
      `${order.order_number}を「${STATUS_LABELS[newStatus]}」に変更しますか？`,
      [
        { text: "戻る", style: "cancel" },
        {
          text: "変更する",
          onPress: async () => {
            if (updateLock.current) return;
            updateLock.current = true;
            setUpdating(true);
            const current = generation.current;
            try {
              await updateOrderStatus(order.id, newStatus, order.status);
              if (current !== generation.current) return;
              await openOrder(order.id);
              setNotice("状態を更新しました。");
              await refreshRef.current();
            } catch (failure) {
              if (current !== generation.current) return;
              await openOrder(order.id);
              setNotice(
                failure.code?.includes("aborted")
                  ? "別のスタッフが更新しました。最新状態を確認して、必要な操作を選び直してください。"
                  : "更新結果を確認してください。通信に失敗した場合も更新済みの可能性があります。詳細を再取得してから操作してください。"
              );
              await refreshRef.current();
            } finally {
              updateLock.current = false;
              if (current === generation.current) setUpdating(false);
            }
          },
        },
      ]
    );
  };
  const hideDetail = () => {
    detailRequest.current++;
    setSelectedId(null);
    setSelected(null);
    setNotice("");
  };
  const detailVisible = selected || selectedId;
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.grow}>
            <Text style={styles.title}>注文受付</Text>
            <Text style={styles.muted}>店舗：{session.restaurantId}</Text>
          </View>
          <Action
            secondary
            onPress={() =>
              signOutStaff().catch(() =>
                setError("ログアウトできません。もう一度お試しください。")
              )
            }
          >
            ログアウト
          </Action>
        </View>
        <View style={styles.toolbar}>
          {[
            ["active", "対応中"],
            ["all", "すべて"],
          ].map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{
                selected: view === key,
                disabled: updating,
              }}
              disabled={updating}
              onPress={() => {
                if (key === view) return;
                hideDetail();
                setListing({ orders: [], hasMore: false, cursor: null });
                setNewCount(0);
                setView(key);
              }}
              style={[styles.tab, view === key && styles.tabSelected]}
            >
              <Text style={view === key ? styles.tabTextSelected : styles.text}>
                {label}
              </Text>
            </Pressable>
          ))}
          <Action
            secondary
            disabled={busy || updating}
            onPress={() => refresh()}
          >
            更新
          </Action>
        </View>
        <Text style={styles.muted}>
          15秒ごとに最新50件を取得
          {lastRefresh ? ` · 最終取得 ${dateLabel(lastRefresh)}` : ""}
        </Text>
        {newCount > 0 && (
          <Action secondary onPress={() => setNewCount(0)}>
            新着 {newCount}件を確認
          </Action>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={[styles.content, wide && styles.contentWide]}>
          {(wide || !detailVisible) && (
            <View style={[styles.listPane, wide && styles.listPaneWide]}>
              <ScrollView contentContainerStyle={styles.listContent}>
                {busy && !listing.orders.length && (
                  <ActivityIndicator
                    color={COLORS.primary}
                    accessibilityLabel="注文を取得中"
                  />
                )}
                {!busy && !listing.orders.length && !error && (
                  <Text style={styles.empty}>対応する注文はありません。</Text>
                )}
                {listing.orders.map((order) => (
                  <Pressable
                    key={order.id}
                    accessibilityRole="button"
                    accessibilityLabel={`注文 ${order.order_number} ${STATUS_LABELS[order.status] || order.status}`}
                    disabled={updating}
                    accessibilityState={{ disabled: updating }}
                    onPress={() => openOrder(order.id)}
                    style={[
                      styles.orderRow,
                      selected?.id === order.id && styles.orderRowSelected,
                    ]}
                  >
                    <View style={styles.row}>
                      <Text style={styles.orderNumber}>
                        {order.order_number}
                      </Text>
                      <Text
                        style={[
                          styles.status,
                          order.status === "pending" && styles.pending,
                        ]}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </Text>
                    </View>
                    <Text style={styles.text}>
                      テーブル {order.table_number} ·{" "}
                      {money(order.total_amount)}
                    </Text>
                    <Text style={styles.muted}>
                      {dateLabel(order.created_at)}
                    </Text>
                  </Pressable>
                ))}
                {listing.hasMore && (
                  <Action
                    secondary
                    disabled={busy}
                    onPress={() => refresh({ more: true })}
                  >
                    さらに前の注文を読み込む
                  </Action>
                )}
              </ScrollView>
            </View>
          )}
          {(wide || detailVisible) && (
            <ScrollView
              style={styles.detail}
              contentContainerStyle={styles.detailContent}
            >
              {!wide && (
                <Action secondary disabled={updating} onPress={hideDetail}>
                  一覧に戻る
                </Action>
              )}
              {!!notice && (
                <Text accessibilityLiveRegion="polite" style={styles.notice}>
                  {notice}
                </Text>
              )}
              {!selected && !notice && (
                <Text style={styles.empty}>
                  注文を選ぶと詳細を確認できます。
                </Text>
              )}
              {selected && (
                <>
                  <Text style={styles.detailTitle}>
                    {selected.order_number}
                  </Text>
                  <Text style={styles.text}>
                    テーブル {selected.table_number} ·{" "}
                    {STATUS_LABELS[selected.status]}
                  </Text>
                  <Text style={styles.muted}>
                    {dateLabel(selected.created_at)} · 注文時の言語：
                    {selected.customer_language || "不明"}
                  </Text>
                  {selected.items.map((item, index) => (
                    <View key={index} style={styles.item}>
                      <View style={styles.row}>
                        <Text style={[styles.itemName, styles.grow]}>
                          {item.name_ja || item.name}
                        </Text>
                        <Text style={styles.itemName}>× {item.quantity}</Text>
                      </View>
                      <Text style={styles.muted}>{money(item.price)} / 点</Text>
                      {!!item.notes && (
                        <Text style={styles.notes}>要望：{item.notes}</Text>
                      )}
                    </View>
                  ))}
                  {!!selected.customer_notes && (
                    <Text style={styles.notes}>
                      注文全体の要望：{selected.customer_notes}
                    </Text>
                  )}
                  <View style={styles.total}>
                    <Text style={styles.itemName}>合計（税込）</Text>
                    <Text style={styles.detailTitle}>
                      {money(selected.total_amount)}
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    {(VALID_STATUS_TRANSITIONS[selected.status] || []).map(
                      (status) => (
                        <Action
                          key={status}
                          disabled={updating || busy}
                          secondary={status === "cancelled"}
                          onPress={() => changeStatus(status)}
                        >
                          {updating ? "更新中…" : actionLabels[status]}
                        </Action>
                      )
                    )}
                  </View>
                  <Action
                    secondary
                    disabled={updating}
                    onPress={() => openOrder(selected.id)}
                  >
                    詳細を再取得
                  </Action>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const StaffScreen = () => {
  const [session, setSession] = useState({
    loading: true,
    user: null,
    restaurantId: null,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => observeStaffSession(setSession), []);
  const login = async () => {
    if (lock.current || !email.trim() || !password) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await signInStaff(email, password);
    } catch {
      setError(
        "ログインできません。メールアドレス・パスワードと接続を確認してください。"
      );
    } finally {
      setPassword("");
      lock.current = false;
      setBusy(false);
    }
  };
  if (session.loading)
    return (
      <SafeAreaView style={styles.loginScreen}>
        <ActivityIndicator
          color={COLORS.primary}
          accessibilityLabel="ログイン状態を確認中"
        />
      </SafeAreaView>
    );
  if (session.restaurantId)
    return (
      <OrderConsole
        key={`${session.user.uid}:${session.restaurantId}`}
        session={session}
      />
    );
  return (
    <SafeAreaView style={styles.loginScreen}>
      <ScrollView
        contentContainerStyle={styles.loginContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.loginForm}>
          <Text style={styles.title}>スタッフログイン</Text>
          <Text style={styles.muted}>
            店舗の注文を確認し、受付から提供までの状態を更新します。
          </Text>
          {!!(error || session.error) && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error || session.error}
            </Text>
          )}
          {!session.user ? (
            <>
              <Text style={styles.label}>メールアドレス</Text>
              <TextInput
                accessibilityLabel="メールアドレス"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                editable={!busy}
              />
              <Text style={styles.label}>パスワード</Text>
              <TextInput
                accessibilityLabel="パスワード"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                editable={!busy}
                onSubmitEditing={login}
              />
              <Action
                disabled={busy || !email.trim() || !password}
                onPress={login}
              >
                {busy ? "ログイン中…" : "ログイン"}
              </Action>
              <Text style={styles.muted}>
                アカウントの発行・再設定は店舗管理者へお問い合わせください。
              </Text>
            </>
          ) : (
            <Action
              secondary
              onPress={() =>
                signOutStaff().catch(() =>
                  setError("ログアウトできません。もう一度お試しください。")
                )
              }
            >
              ログアウト
            </Action>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  muted: { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary },
  text: { fontSize: 16, lineHeight: 24, color: COLORS.text },
  grow: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  tab: {
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabSelected: { borderBottomColor: "#B71C1C" },
  tabTextSelected: { fontSize: 16, fontWeight: "700", color: "#B71C1C" },
  content: { flex: 1, gap: 24 },
  contentWide: { flexDirection: "row" },
  listPane: { flex: 1 },
  listPaneWide: { flexGrow: 0, flexShrink: 0, flexBasis: 390, width: 390 },
  listContent: { paddingBottom: 24 },
  orderRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 6,
  },
  orderRowSelected: { backgroundColor: "#FFEBE9" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    flexShrink: 1,
  },
  status: { color: COLORS.textSecondary, fontWeight: "600" },
  pending: { color: "#B71C1C" },
  detail: { flex: 1, backgroundColor: COLORS.surface },
  detailContent: { padding: 20, gap: 12, paddingBottom: 32 },
  detailTitle: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  item: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 6,
  },
  itemName: { fontSize: 18, fontWeight: "600", color: COLORS.text },
  notes: { fontSize: 16, lineHeight: 24, color: "#8A3B00" },
  total: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 16,
  },
  actions: { gap: 12 },
  action: {
    minHeight: 44,
    backgroundColor: "#B71C1C",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 16, fontWeight: "600", color: COLORS.surface },
  secondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryText: { color: COLORS.text },
  disabled: { opacity: 0.45 },
  error: { color: "#B71C1C", fontSize: 16, lineHeight: 24, paddingVertical: 8 },
  notice: { color: "#8A3B00", fontSize: 16, lineHeight: 24 },
  empty: {
    paddingVertical: 32,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textSecondary,
  },
  loginScreen: { flex: 1, backgroundColor: COLORS.background },
  loginContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loginForm: { width: "100%", maxWidth: 420, gap: 16 },
  label: { color: COLORS.text, fontSize: 16, fontWeight: "600" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    fontSize: 16,
    color: COLORS.text,
    padding: 12,
  },
});
export default StaffScreen;
