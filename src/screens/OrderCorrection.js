// スタッフが注文の商品を減数・取消する。増数や別商品への変更は追加注文で行う。
// 金額は表示用に試算するだけで、確定値はサーバーが計算する。
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { COLORS, TAX_RATE } from "../constants";
import { correctOrderItems } from "../services/api";
import { showAlert } from "../utils/dialogs";
import { createRequestId } from "../utils/requestId";

const CORRECTABLE = ["pending", "confirmed", "preparing"];
const money = (value) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;
const totalOf = (items) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return subtotal + Math.floor(subtotal * TAX_RATE);
};

const Button = ({ label, onPress, disabled, name }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={name || label}
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    onPress={onPress}
    style={[styles.button, disabled && styles.disabled]}
  >
    <Text style={styles.text}>{label}</Text>
  </Pressable>
);

const OrderCorrection = ({ order, disabled, onDone }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  if (!CORRECTABLE.includes(order.status)) return null;
  if (!editing)
    return (
      <Button
        label="数量を訂正する（減数・取消）"
        disabled={disabled}
        onPress={() => {
          setDraft({});
          setReason("");
          setEditing(true);
        }}
      />
    );
  const quantityOf = (index) => draft[index] ?? order.items[index].quantity;
  const set = (index, quantity) =>
    setDraft((previous) => ({ ...previous, [index]: quantity }));
  const changes = order.items
    .map((item, index) => ({ index, quantity: quantityOf(index) }))
    .filter(({ index, quantity }) => quantity !== order.items[index].quantity);
  const preview = totalOf(
    order.items.map((item, index) => ({ ...item, quantity: quantityOf(index) }))
  );
  const summary = changes
    .map(
      ({ index, quantity }) =>
        `${order.items[index].name_ja}：${order.items[index].quantity} → ${quantity || "取消"}`
    )
    .join("\n");
  const save = () =>
    showAlert(
      "注文の訂正",
      `${order.order_number}を訂正しますか？\n${summary}\n合計（目安）：${money(order.total_amount)} → ${money(preview)}${preview === 0 ? "\nすべての商品を取り消すため、注文はキャンセルになります。" : ""}`,
      [
        { text: "戻る", style: "cancel" },
        {
          text: "訂正する",
          onPress: async () => {
            setSaving(true);
            try {
              const result = await correctOrderItems({
                orderId: order.id,
                expectedRevision: order.revision || 0,
                changes,
                reason: reason.trim(),
                operationId: createRequestId(),
              });
              setEditing(false);
              onDone(
                result.status === "cancelled"
                  ? "すべての商品を取り消し、注文をキャンセルしました。"
                  : `訂正しました。合計は${money(result.total_amount)}です。`
              );
            } catch (error) {
              setEditing(false);
              onDone(
                error.code?.includes("aborted")
                  ? "別のスタッフが注文を更新しました。最新の内容を確認して、必要なら訂正し直してください。"
                  : error.details?.reason === "not_correctable"
                    ? "提供待ち以降の注文は訂正できません。最新の状態を表示しました。"
                    : "訂正できたか確認できません。最新の内容を表示しました。必要なら訂正し直してください。"
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  return (
    <View style={styles.box}>
      <Text style={styles.title}>数量の訂正</Text>
      <Text style={styles.muted}>
        減らす・取り消すことだけができます。増やす場合は追加注文にしてください。
      </Text>
      {order.items.map((item, index) =>
        item.quantity > 0 ? (
          <View key={index} style={styles.line}>
            <Text style={[styles.text, styles.grow]}>
              {item.name_ja}：{item.quantity} → {quantityOf(index) || "取消"}
            </Text>
            <Button
              label="−1"
              name={`${item.name_ja}を1つ減らす`}
              disabled={quantityOf(index) === 0 || saving}
              onPress={() => set(index, quantityOf(index) - 1)}
            />
            <Button
              label="取消"
              name={`${item.name_ja}を取り消す`}
              disabled={quantityOf(index) === 0 || saving}
              onPress={() => set(index, 0)}
            />
            <Button
              label="元に戻す"
              name={`${item.name_ja}を元に戻す`}
              disabled={quantityOf(index) === item.quantity || saving}
              onPress={() => set(index, item.quantity)}
            />
          </View>
        ) : null
      )}
      <TextInput
        accessibilityLabel="訂正の理由（必須）"
        placeholder="訂正の理由（必須・100文字まで）"
        maxLength={100}
        value={reason}
        onChangeText={setReason}
        editable={!saving}
        style={styles.input}
      />
      <Text style={styles.text}>
        合計（目安）：{money(order.total_amount)} → {money(preview)}
      </Text>
      <View style={styles.line}>
        <Button
          label={saving ? "保存中…" : "訂正を保存"}
          disabled={!changes.length || !reason.trim() || saving || disabled}
          onPress={save}
        />
        <Button
          label="やめる"
          disabled={saving}
          onPress={() => setEditing(false)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  text: { fontSize: 16, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textSecondary },
  grow: { flex: 1, minWidth: 160 },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
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

export default OrderCorrection;
