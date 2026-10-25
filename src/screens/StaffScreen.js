import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  AppState,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants";
import {
  ORDER_STATUS,
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
  closeTableVisit,
} from "../services/api";
import { showAlert } from "../utils/dialogs";
import StaffMenuManager from "./StaffMenuManager";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import {
  enableAlertSound,
  disableAlertSound,
  playNewOrderAlert,
  showTitleBadge,
} from "../utils/newOrderAlert";

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
// Orders placed before table numbers were recorded only have the internal ID.
const tableLabel = (order) =>
  order.table_number
    ? `テーブル ${order.table_number}`
    : `テーブル番号未記録（ID: ${order.table_id}）`;
// Minutes since the order was placed, for orders still being handled.
const ACTIVE = ["pending", "confirmed", "preparing", "ready", "served"];
const LONG_WAIT_MINUTES = 10;
const waitedMinutes = (order, now) =>
  ACTIVE.includes(order.status) && order.created_at
    ? Math.max(0, Math.floor((now - order.created_at) / 60000))
    : null;
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
  const { isOnline } = useNetworkStatus();
  const [mode, setMode] = useState("orders"); // orders | menu
  const [view, setView] = useState("active");
  const [sort, setSort] = useState("newest");
  const [statusFilter, setStatusFilter] = useState(null);
  const [tableFilter, setTableFilter] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [soundMessage, setSoundMessage] = useState("");
  const soundRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
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
  // Orders that arrived after the first load and have not been opened yet.
  const [fresh, setFresh] = useState(() => new Set());
  const listScroll = useRef(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const generation = useRef(0);
  const loading = useRef(false);
  const seen = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
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
          sort,
          ...(more ? { cursor: listing.cursor } : {}),
        });
        if (current !== generation.current) return;
        if (!more) {
          if (seen.current) {
            const added = result.orders
              .filter((order) => !seen.current.has(order.id))
              .map((order) => order.id);
            setNewCount((count) => count + added.length);
            if (added.length) {
              setFresh((previous) => new Set([...previous, ...added]));
              if (soundRef.current) playNewOrderAlert();
            }
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
    [view, sort, listing.cursor]
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
    // Coming back from sleep or another tab: fetch at once instead of waiting.
    const resume = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshRef.current({ quiet: true });
    });
    return () => {
      clearInterval(timer);
      resume.remove();
      lifetime.current++;
      detailLifetime.current++;
    };
  }, [view, sort]);
  const wasOnline = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnline.current) refreshRef.current({ quiet: true });
    wasOnline.current = isOnline;
  }, [isOnline]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    showTitleBadge(newCount);
  }, [newCount]);
  useEffect(
    () => () => {
      showTitleBadge(0);
      disableAlertSound();
    },
    []
  );
  const toggleSound = () => {
    if (soundOn) {
      disableAlertSound();
      soundRef.current = false;
      setSoundOn(false);
      return;
    }
    // Browsers allow sound only after a user action, so enable it here.
    if (enableAlertSound()) {
      soundRef.current = true;
      setSoundOn(true);
      setSoundMessage("");
      playNewOrderAlert();
    } else
      setSoundMessage(
        "この端末では通知音を使えません。新着は画面の「新着」の表示で確認してください。"
      );
  };

  const openOrder = async (id) => {
    const request = ++detailRequest.current;
    setFresh((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    setSelectedId(id);
    setSelected(null);
    setCancelReason("");
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
    const reason =
      newStatus === ORDER_STATUS.CANCELLED ? cancelReason.trim() : "";
    showAlert(
      "注文の状態を変更",
      `${order.order_number}を「${STATUS_LABELS[newStatus]}」に変更しますか？${reason ? `\n理由：${reason}` : ""}`,
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
              const args = [order.id, newStatus, order.status];
              if (reason) args.push(reason);
              await updateOrderStatus(...args);
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
  // Clearing the table ends the customers' visit: their devices stop seeing
  // these orders and the next customers start a fresh history.
  const closeVisit = () => {
    const order = selected;
    showAlert(
      "来店を終了",
      `${tableLabel(order)}の来店を終了しますか？\nテーブルは空席になり、お客様の端末からこれまでの注文履歴は見えなくなります。`,
      [
        { text: "戻る", style: "cancel" },
        {
          text: "終了する",
          onPress: async () => {
            try {
              await closeTableVisit(order.table_id);
              setNotice(`${tableLabel(order)}の来店を終了しました。`);
            } catch {
              setNotice(
                "来店を終了できません。接続を確認して、もう一度お試しください。"
              );
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
  const tableQuery = tableFilter.trim();
  const filtering = !!statusFilter || !!tableQuery;
  // Filters apply to the rows already loaded; the counts above do not change.
  const shownOrders = listing.orders.filter(
    (order) =>
      (!statusFilter || order.status === statusFilter) &&
      (!tableQuery ||
        String(order.table_number ?? order.table_id).includes(tableQuery))
  );
  // Show the list where the new rows are (newest first) before clearing the
  // banner; each row keeps its "新着" mark until that order is opened.
  const showNewOrders = () => {
    if (!wide) hideDetail();
    listScroll.current?.scrollTo({ y: 0, animated: true });
    setNewCount(0);
  };
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
            ["orders", "注文受付"],
            ["menu", "メニュー管理"],
          ].map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{
                selected: mode === key,
                disabled: updating,
              }}
              disabled={updating}
              onPress={() => setMode(key)}
              style={[styles.tab, mode === key && styles.tabSelected]}
            >
              <Text style={mode === key ? styles.tabTextSelected : styles.text}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {mode === "menu" ? (
          <>
            {newCount > 0 && (
              <Action
                secondary
                onPress={() => {
                  setMode("orders");
                  showNewOrders();
                }}
              >
                新着 {newCount}件を確認
              </Action>
            )}
            <StaffMenuManager />
          </>
        ) : (
          <>
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
                    setFresh(new Set());
                    setView(key);
                  }}
                  style={[styles.tab, view === key && styles.tabSelected]}
                >
                  <Text
                    style={view === key ? styles.tabTextSelected : styles.text}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
              {[
                ["newest", "新しい順"],
                ["oldest", "待ち時間順"],
              ].map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: sort === key,
                    disabled: updating,
                  }}
                  disabled={updating}
                  onPress={() => {
                    if (key === sort) return;
                    setListing({ orders: [], hasMore: false, cursor: null });
                    setNewCount(0);
                    setFresh(new Set());
                    setSort(key);
                  }}
                  style={[styles.tab, sort === key && styles.tabSelected]}
                >
                  <Text
                    style={sort === key ? styles.tabTextSelected : styles.text}
                  >
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
              <Action secondary onPress={toggleSound}>
                {soundOn ? "通知音：オン" : "通知音をオンにする"}
              </Action>
            </View>
            <Text style={styles.muted}>
              15秒ごとに{sort === "oldest" ? "待ち時間の長い順に" : "最新の"}
              50件を取得
              {lastRefresh ? ` · 最終取得 ${dateLabel(lastRefresh)}` : ""}
            </Text>
            {!!soundMessage && <Text style={styles.muted}>{soundMessage}</Text>}
            {listing.limitAlert && (
              <Text accessibilityRole="alert" style={styles.error}>
                直近1時間に、短時間の連続注文の制限が{listing.limitAlert.count}
                回ありました（最後：
                {listing.limitAlert.lastTableNumber
                  ? `テーブル ${listing.limitAlert.lastTableNumber}`
                  : `テーブルID ${listing.limitAlert.lastTableId}`}
                ）。
                {listing.limitAlert.enforced
                  ? "該当の注文は受け付けていません。"
                  : "記録のみで、注文は受け付けています。"}
                異常な注文が続く場合は、メニュー管理で注文受付を停止してください。
              </Text>
            )}
            {Number.isInteger(listing.pendingCount) && (
              <Text style={styles.summary}>
                未受付 {listing.pendingCount}件（店舗全体）
              </Text>
            )}
            {!isOnline && (
              <Text accessibilityRole="alert" style={styles.error}>
                オフラインです。注文を取得できません。表示中の情報は最新ではありません。
              </Text>
            )}
            <View style={styles.toolbar}>
              {[null, ...ACTIVE].map((status) => (
                <Pressable
                  key={status || "any"}
                  accessibilityRole="button"
                  accessibilityState={{ selected: statusFilter === status }}
                  onPress={() => setStatusFilter(status)}
                  style={[
                    styles.chip,
                    statusFilter === status && styles.tabSelected,
                  ]}
                >
                  <Text
                    style={
                      statusFilter === status
                        ? styles.tabTextSelected
                        : styles.text
                    }
                  >
                    {status ? STATUS_LABELS[status] : "状態：すべて"}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                accessibilityLabel="テーブル番号で絞り込み"
                placeholder="テーブル番号"
                value={tableFilter}
                onChangeText={setTableFilter}
                style={[styles.input, styles.tableFilter]}
              />
            </View>
            {filtering && (
              <Text style={styles.muted}>
                絞り込み中：読み込み済みの{listing.orders.length}件のうち
                {shownOrders.length}
                件を表示（新着と未受付の件数は絞り込みに関係なく数えます）
              </Text>
            )}
            {newCount > 0 && (
              <Action secondary disabled={updating} onPress={showNewOrders}>
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
                  <ScrollView
                    ref={listScroll}
                    contentContainerStyle={styles.listContent}
                  >
                    {busy && !listing.orders.length && (
                      <ActivityIndicator
                        color={COLORS.primary}
                        accessibilityLabel="注文を取得中"
                      />
                    )}
                    {!busy && !listing.orders.length && !error && (
                      <Text style={styles.empty}>
                        対応する注文はありません。
                      </Text>
                    )}
                    {shownOrders.map((order) => (
                      <Pressable
                        key={order.id}
                        accessibilityRole="button"
                        accessibilityLabel={`注文 ${order.order_number} ${STATUS_LABELS[order.status] || order.status}${fresh.has(order.id) ? " 新着" : ""}`}
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
                          {fresh.has(order.id) && (
                            <Text style={styles.freshBadge}>新着</Text>
                          )}
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
                          {tableLabel(order)} · {money(order.total_amount)}
                        </Text>
                        <Text
                          style={
                            order.status === "pending" &&
                            waitedMinutes(order, now) >= LONG_WAIT_MINUTES
                              ? styles.longWait
                              : styles.muted
                          }
                        >
                          {dateLabel(order.created_at)}
                          {waitedMinutes(order, now) !== null &&
                            ` · 経過 ${waitedMinutes(order, now)}分`}
                          {order.status === "pending" &&
                            waitedMinutes(order, now) >= LONG_WAIT_MINUTES &&
                            " · 待ち時間が長い注文"}
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
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.notice}
                    >
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
                        {tableLabel(selected)} ·{" "}
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
                            <Text style={styles.itemName}>
                              × {item.quantity}
                            </Text>
                          </View>
                          <Text style={styles.muted}>
                            {money(item.price)} / 点
                          </Text>
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
                      {(
                        VALID_STATUS_TRANSITIONS[selected.status] || []
                      ).includes(ORDER_STATUS.CANCELLED) && (
                        <TextInput
                          accessibilityLabel="キャンセル理由（任意）"
                          placeholder="キャンセル理由（任意・100文字まで）"
                          maxLength={100}
                          value={cancelReason}
                          onChangeText={setCancelReason}
                          editable={!updating}
                          style={styles.input}
                        />
                      )}
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
                      <Action
                        secondary
                        disabled={updating}
                        onPress={closeVisit}
                      >
                        このテーブルの来店を終了する
                      </Action>
                      <Text style={styles.sectionTitle}>操作履歴</Text>
                      {!selected.history?.length && (
                        <Text style={styles.muted}>
                          まだ状態の変更はありません。
                        </Text>
                      )}
                      {(selected.history || []).map((entry, index) => (
                        <View key={index} style={styles.historyItem}>
                          <Text style={styles.text}>
                            {STATUS_LABELS[entry.from_status] ||
                              entry.from_status}{" "}
                            →{" "}
                            {STATUS_LABELS[entry.to_status] || entry.to_status}
                          </Text>
                          <Text style={styles.muted}>
                            {dateLabel(entry.created_at)} ·{" "}
                            {entry.staff_email || "スタッフ不明"}
                          </Text>
                          {!!entry.reason && (
                            <Text style={styles.notes}>
                              理由：{entry.reason}
                            </Text>
                          )}
                        </View>
                      ))}
                    </>
                  )}
                </ScrollView>
              )}
            </View>
          </>
        )}
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
  longWait: { color: "#B71C1C", fontWeight: "700" },
  summary: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  chip: {
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tableFilter: { minWidth: 120, flexGrow: 1 },
  freshBadge: {
    color: "#FFFFFF",
    backgroundColor: "#B71C1C",
    fontWeight: "700",
    paddingHorizontal: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 8,
  },
  historyItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 2,
  },
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
