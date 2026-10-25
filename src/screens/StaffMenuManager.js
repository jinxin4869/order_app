// スタッフのメニュー管理：商品の売り切れ・販売再開と、店舗の注文受付の停止・再開。
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { COLORS } from "../constants";
import {
  getStaffMenu,
  setMenuItemAvailability,
  setOrderingAvailability,
  batchTranslateMenu,
} from "../services/api";
import MenuItemEditor from "./MenuItemEditor";
import { showAlert } from "../utils/dialogs";
import { createRequestId } from "../utils/requestId";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

const ORDERING_LABELS = {
  open: "受付中",
  paused: "受付停止中",
  invalid: "設定を確認してください（受付できません）",
};
const money = (value) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;
const timeLabel = (millis) =>
  new Date(millis).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });

const Chip = ({ label, selected, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    style={[styles.chip, selected && styles.chipSelected]}
  >
    <Text style={selected ? styles.chipTextSelected : styles.text}>
      {label}
    </Text>
  </Pressable>
);

const StaffMenuManager = ({ restaurantId, canEditMenu = false }) => {
  const { isOnline } = useNetworkStatus();
  const [editingId, setEditingId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [updatedAt, setUpdatedAt] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(null);
  const [sale, setSale] = useState(null); // null | "on" | "off"
  const [saving, setSaving] = useState(null); // item ID or "ordering"
  const [rowMessage, setRowMessage] = useState({});
  const [message, setMessage] = useState("");
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    try {
      const result = await getStaffMenu();
      if (current !== request.current) return;
      setMenu(result);
      setStatus("ready");
      setUpdatedAt(Date.now());
    } catch {
      if (current === request.current) setStatus("error");
    }
  }, []);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current();
    const requests = request;
    return () => {
      requests.current++;
    };
  }, []);

  // Never guess the outcome of a failed save: show the server's current state.
  const failed = (error, key) => {
    const text = error.code?.includes("aborted")
      ? "別のスタッフが変更しました。最新の状態を確認して、必要なら操作し直してください。"
      : "保存できたか確認できません。最新の状態を表示しました。必要なら操作し直してください。";
    if (key === "ordering") setMessage(text);
    else setRowMessage((previous) => ({ ...previous, [key]: text }));
    return load();
  };

  const changeItem = (item, available) =>
    showAlert(
      "販売状態の変更",
      `「${item.name_ja}」を${available ? "販売中" : "売り切れ"}にしますか？`,
      [
        { text: "戻る", style: "cancel" },
        {
          text: "変更する",
          onPress: async () => {
            setSaving(item.id);
            setRowMessage((previous) => ({ ...previous, [item.id]: "" }));
            try {
              const result = await setMenuItemAvailability({
                itemId: item.id,
                available,
                expectedVersion: item.version,
                operationId: createRequestId(),
              });
              setMenu((previous) => ({
                ...previous,
                items: previous.items.map((entry) =>
                  entry.id === item.id
                    ? {
                        ...entry,
                        available: result.available,
                        version: result.version,
                      }
                    : entry
                ),
              }));
              setRowMessage((previous) => ({
                ...previous,
                [item.id]: result.available
                  ? "販売を再開しました。"
                  : "売り切れにしました。",
              }));
            } catch (error) {
              await failed(error, item.id);
            } finally {
              setSaving(null);
            }
          },
        },
      ]
    );

  const changeOrdering = (enabled) =>
    showAlert(
      enabled ? "注文受付の再開" : "注文受付の停止",
      enabled
        ? "店舗全体の新規注文の受付を再開しますか？売り切れの商品は売り切れのままです。"
        : "店舗全体の新規注文の受付を停止しますか？お客様はメニューとカートを見られますが、注文を確定できません。受付済みの注文はそのまま対応できます。",
      [
        { text: "戻る", style: "cancel" },
        {
          text: enabled ? "再開する" : "停止する",
          onPress: async () => {
            setSaving("ordering");
            setMessage("");
            try {
              const result = await setOrderingAvailability({
                enabled,
                expectedVersion: menu.restaurant.version,
                operationId: createRequestId(),
              });
              setMenu((previous) => ({
                ...previous,
                restaurant: {
                  ...previous.restaurant,
                  ordering: result.ordering,
                  version: result.version,
                },
              }));
              setMessage(
                enabled
                  ? "注文受付を再開しました。"
                  : "注文受付を停止しました。"
              );
            } catch (error) {
              await failed(error, "ordering");
            } finally {
              setSaving(null);
            }
          },
        },
      ]
    );

  // Regenerate English and Chinese (with and without the dictionary) from
  // the current Japanese text after editing names or descriptions.
  const updateTranslations = () =>
    showAlert(
      "翻訳を更新",
      "店舗の全商品・カテゴリの英語・中国語の翻訳（辞書あり・なし）を、現在の日本語から作り直しますか？DeepLの利用枠を使います。",
      [
        { text: "戻る", style: "cancel" },
        {
          text: "更新する",
          onPress: async () => {
            setSaving("translations");
            setMessage("翻訳を更新しています…");
            try {
              for (const language of ["en", "zh"])
                await batchTranslateMenu(restaurantId, language, {
                  generateBothModes: true,
                });
              setMessage("英語・中国語の翻訳を更新しました。");
            } catch {
              setMessage(
                "翻訳を更新できませんでした。時間を置いてもう一度お試しください。更新できなかった翻訳は、お客様の画面で日本語の原文として表示されます。"
              );
            } finally {
              setSaving(null);
            }
          },
        },
      ]
    );

  if (editingId)
    return (
      <MenuItemEditor
        itemId={editingId}
        onClose={(changed) => {
          setEditingId(null);
          if (changed) load();
        }}
      />
    );
  if (status === "loading" && !menu)
    return (
      <ActivityIndicator
        color={COLORS.primary}
        accessibilityLabel="メニューを取得中"
      />
    );
  if (!menu)
    return (
      <View style={styles.box}>
        <Text accessibilityRole="alert" style={styles.error}>
          メニューを取得できません。接続を確認して「更新」を押してください。
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={load}
          style={styles.button}
        >
          <Text style={styles.text}>更新</Text>
        </Pressable>
      </View>
    );

  const categoryName = Object.fromEntries(
    menu.categories.map((entry) => [entry.id, entry.name_ja])
  );
  const text = query.trim();
  const shown = menu.items.filter(
    (item) =>
      (!category || item.category_id === category) &&
      (sale === null || item.available === (sale === "on")) &&
      (!text || item.name_ja.includes(text))
  );
  const ordering = menu.restaurant.ordering;
  const locked = !isOnline || saving !== null;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.box}>
        <Text style={styles.title}>
          {menu.restaurant.name || "店舗"}：注文{ORDERING_LABELS[ordering]}
        </Text>
        <Text style={styles.muted}>
          最終取得 {updatedAt ? timeLabel(updatedAt) : "—"}
          {status === "error" && " · 最新の状態を取得できません"}
        </Text>
        {!isOnline && (
          <Text accessibilityRole="alert" style={styles.error}>
            オフラインのため変更できません。
          </Text>
        )}
        {!!message && (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {message}
          </Text>
        )}
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: locked }}
            disabled={locked}
            onPress={() => changeOrdering(ordering !== "open")}
            style={[styles.button, locked && styles.disabled]}
          >
            <Text style={styles.text}>
              {saving === "ordering"
                ? "保存中…"
                : ordering === "open"
                  ? "注文受付を停止する"
                  : "注文受付を再開する"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={load}
            style={styles.button}
          >
            <Text style={styles.text}>更新</Text>
          </Pressable>
          {canEditMenu && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: locked }}
              disabled={locked}
              onPress={updateTranslations}
              style={[styles.button, locked && styles.disabled]}
            >
              <Text style={styles.text}>
                {saving === "translations" ? "翻訳を更新中…" : "翻訳を更新"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      <TextInput
        accessibilityLabel="商品名で検索"
        placeholder="商品名で検索"
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />
      <View style={styles.row}>
        <Chip
          label="カテゴリ：すべて"
          selected={!category}
          onPress={() => setCategory(null)}
        />
        {menu.categories.map((entry) => (
          <Chip
            key={entry.id}
            label={entry.name_ja}
            selected={category === entry.id}
            onPress={() => setCategory(entry.id)}
          />
        ))}
      </View>
      <View style={styles.row}>
        {[
          [null, "状態：すべて"],
          ["on", "販売中"],
          ["off", "売り切れ"],
        ].map(([key, label]) => (
          <Chip
            key={label}
            label={label}
            selected={sale === key}
            onPress={() => setSale(key)}
          />
        ))}
      </View>
      <Text style={styles.muted}>
        公開中の商品{menu.items.length}件のうち{shown.length}件を表示
      </Text>
      {!menu.items.length && (
        <Text style={styles.muted}>公開中の商品はありません。</Text>
      )}
      {shown.map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.muted}>
            {categoryName[item.category_id] || "カテゴリなし"}
          </Text>
          <View style={styles.rowBetween}>
            <Text style={[styles.itemName, styles.grow]}>{item.name_ja}</Text>
            <Text style={styles.text}>{money(item.price)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={item.available ? styles.onSale : styles.soldOut}>
              {item.available ? "販売中" : "売り切れ"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name_ja}を${item.available ? "売り切れにする" : "販売を再開する"}`}
              accessibilityState={{ disabled: locked }}
              disabled={locked}
              onPress={() => changeItem(item, !item.available)}
              style={[styles.button, locked && styles.disabled]}
            >
              <Text style={styles.text}>
                {saving === item.id
                  ? "保存中…"
                  : item.available
                    ? "売り切れにする"
                    : "販売を再開する"}
              </Text>
            </Pressable>
          </View>
          {canEditMenu && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name_ja}を編集`}
              accessibilityState={{ disabled: locked }}
              disabled={locked}
              onPress={() => setEditingId(item.id)}
              style={[styles.button, locked && styles.disabled]}
            >
              <Text style={styles.text}>商品名・価格・写真を編集</Text>
            </Pressable>
          )}
          {!!rowMessage[item.id] && (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {rowMessage[item.id]}
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12, paddingBottom: 32 },
  box: {
    padding: 12,
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  text: { fontSize: 16, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textSecondary },
  error: { fontSize: 16, color: "#B71C1C" },
  notice: { fontSize: 15, color: "#8A3B00" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  grow: { flex: 1 },
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
  chip: {
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  chipTextSelected: { fontSize: 16, color: COLORS.surface },
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
  item: {
    padding: 12,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  itemName: { fontSize: 17, fontWeight: "600", color: COLORS.text },
  onSale: { fontSize: 16, fontWeight: "700", color: "#1B5E20" },
  soldOut: { fontSize: 16, fontWeight: "700", color: "#B71C1C" },
});

export default StaffMenuManager;
