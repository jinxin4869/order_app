// 商品情報（名前・説明・価格・画像URL）の下書きと公開。編集権限のあるスタッフ用。
// 下書きはお客様に見えない。公開で日本語の原文が変わると、翻訳を更新するまで
// お客様の画面は日本語の原文を「未確認」として表示する。
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
  getEditableMenuItem,
  saveMenuItemDraft,
  publishMenuItemDraft,
  discardMenuItemDraft,
} from "../services/api";
import { showAlert } from "../utils/dialogs";
import { createRequestId } from "../utils/requestId";
import MenuImage from "../components/MenuImage";

const money = (value) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;
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
const Field = ({ label, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} style={styles.input} {...props} />
  </View>
);
const formOf = (source) => ({
  name_ja: source.name_ja || "",
  description_ja: source.description_ja || "",
  price: String(source.price ?? ""),
  image_url: source.image_url || "",
});

const MenuItemEditor = ({ itemId, onClose }) => {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await getEditableMenuItem({ itemId });
      setData(result);
      setForm(formOf(result.draft || result.item));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [itemId]);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current();
  }, [itemId]);

  if (failed && !data)
    return (
      <View style={styles.box}>
        <Text accessibilityRole="alert" style={styles.error}>
          商品情報を取得できません。編集権限と接続を確認してください。
        </Text>
        <Button label="一覧に戻る" onPress={() => onClose(false)} />
      </View>
    );
  if (!data || !form)
    return (
      <ActivityIndicator
        color={COLORS.primary}
        accessibilityLabel="商品情報を取得中"
      />
    );

  const draftValues = {
    name_ja: form.name_ja,
    description_ja: form.description_ja,
    price: Number(form.price),
    image_url: form.image_url,
  };
  const reloadWith = async (text) => {
    await load();
    setMessage(text);
  };
  const failure = (error) =>
    error.code?.includes("aborted")
      ? "公開中の内容が変わりました。最新の内容を表示しました。確認してから操作し直してください。"
      : error.code?.includes("invalid-argument")
        ? error.message
        : "保存できたか確認できません。最新の内容を表示しました。";

  const saveDraft = async () => {
    setBusy(true);
    try {
      await saveMenuItemDraft({
        itemId,
        expectedVersion: data.item.version,
        draft: draftValues,
        operationId: createRequestId(),
      });
      await reloadWith(
        "下書きを保存しました。お客様の画面はまだ変わりません。"
      );
    } catch (error) {
      if (error.code?.includes("invalid-argument")) setMessage(error.message);
      else await reloadWith(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const publish = () => {
    const live = data.item;
    const draft = data.draft;
    const changes = [
      live.name_ja !== draft.name_ja &&
        `商品名：${live.name_ja} → ${draft.name_ja}`,
      live.price !== draft.price &&
        `価格：${money(live.price)} → ${money(draft.price)}`,
      live.description_ja !== draft.description_ja && "説明を変更",
      live.image_url !== draft.image_url && "画像を変更",
    ].filter(Boolean);
    showAlert(
      "下書きを公開",
      `${changes.join("\n") || "変更はありません"}\n公開するとお客様のメニューに反映されます。価格の変更は、注文前のカートに再確認を求めます。商品名・説明を変えた場合は、翻訳を更新するまで英語・中国語の画面に日本語の原文が表示されます。`,
      [
        { text: "戻る", style: "cancel" },
        {
          text: "公開する",
          onPress: async () => {
            setBusy(true);
            try {
              const result = await publishMenuItemDraft({
                itemId,
                expectedVersion: data.item.version,
                operationId: createRequestId(),
              });
              await reloadWith(
                result.translationsOutdated
                  ? "公開しました。メニュー管理の「翻訳を更新」で英語・中国語の翻訳を更新してください。"
                  : "公開しました。"
              );
            } catch (error) {
              await reloadWith(failure(error));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };
  const discard = () =>
    showAlert("下書きを破棄", "保存した下書きを破棄しますか？", [
      { text: "戻る", style: "cancel" },
      {
        text: "破棄する",
        onPress: async () => {
          setBusy(true);
          try {
            await discardMenuItemDraft({ itemId });
            await reloadWith("下書きを破棄しました。");
          } catch {
            await reloadWith("破棄できたか確認できません。");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Button
          label="一覧に戻る"
          disabled={busy}
          onPress={() => onClose(true)}
        />
      </View>
      <Text style={styles.title}>商品情報の編集：{data.item.name_ja}</Text>
      <Text style={styles.muted}>
        公開中：{data.item.name_ja} · {money(data.item.price)}（版{" "}
        {data.item.version}）
      </Text>
      {data.draft ? (
        <Text style={styles.notice}>
          未公開の下書きがあります
          {data.draft.staff_email ? `（${data.draft.staff_email}）` : ""}。
        </Text>
      ) : (
        <Text style={styles.muted}>下書きはありません。</Text>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {message}
        </Text>
      )}
      <Field
        label="商品名（日本語・必須）"
        value={form.name_ja}
        maxLength={100}
        onChangeText={(name_ja) => setForm({ ...form, name_ja })}
      />
      <Field
        label="説明（日本語）"
        value={form.description_ja}
        maxLength={500}
        multiline
        onChangeText={(description_ja) => setForm({ ...form, description_ja })}
      />
      <Field
        label="価格（税抜・円）"
        value={form.price}
        keyboardType="number-pad"
        onChangeText={(price) =>
          setForm({
            ...form,
            // Japanese keyboards often type full-width digits.
            price: price
              .replace(/[０-９]/g, (digit) =>
                String.fromCharCode(digit.charCodeAt(0) - 0xfee0)
              )
              .replace(/[^0-9]/g, ""),
          })
        }
      />
      <Field
        label="画像URL（https）"
        value={form.image_url}
        autoCapitalize="none"
        onChangeText={(image_url) => setForm({ ...form, image_url })}
      />
      <Text style={styles.muted}>
        アレルゲン：{data.item.allergens.join("、") || "登録なし"}
        （この画面では変更しません。変更は店舗で確認してから管理者が行います）
      </Text>
      <View style={styles.preview}>
        <Text style={styles.label}>プレビュー（保存前の入力）</Text>
        <MenuImage uri={form.image_url} style={styles.image} />
        <Text style={styles.title}>{form.name_ja}</Text>
        <Text style={styles.text}>{money(form.price)}</Text>
        <Text style={styles.muted}>{form.description_ja}</Text>
      </View>
      <View style={styles.row}>
        <Button
          label={busy ? "保存中…" : "下書きを保存"}
          disabled={busy || !form.name_ja.trim() || form.price === ""}
          onPress={saveDraft}
        />
        <Button
          label="下書きを公開"
          disabled={busy || !data.draft}
          onPress={publish}
        />
        <Button
          label="下書きを破棄"
          disabled={busy || !data.draft}
          onPress={discard}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12, paddingBottom: 32 },
  box: { padding: 12, gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  text: { fontSize: 16, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  notice: { fontSize: 15, color: "#8A3B00" },
  error: { fontSize: 16, color: "#B71C1C" },
  field: { gap: 4 },
  label: { fontSize: 15, fontWeight: "600", color: COLORS.text },
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
  preview: {
    gap: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  image: { width: 120, height: 120, borderRadius: 8 },
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

export default MenuItemEditor;
