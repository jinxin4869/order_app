// カート画面
import React, { useContext, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  COLORS,
  FONT_SIZES,
  MAX_ORDER_QUANTITY,
  MAX_ORDER_TOTAL_QUANTITY,
} from "../constants";
import { useLanguage } from "../hooks/useLanguage";
import { useResponsive } from "../hooks/useResponsive";
import { CartContext } from "../context/CartContext";
import { translationDisplay } from "../utils/translationDisplay";
import { createOrder } from "../services/api";
import { showAlert } from "../utils/dialogs";
import { taxIncluded, taxLabel, yen } from "../utils/price";
import PendingOrderNotice from "../components/PendingOrderNotice";
import OrderingNotice from "../components/OrderingNotice";
import MenuImage from "../components/MenuImage";
import { useMenuAvailability, isSoldOut } from "../hooks/useMenuAvailability";

const CartScreen = ({ navigation, route }) => {
  const { restaurantId, tableId, restaurant, table } = route.params;
  const { currentLanguage, translationMode } = useLanguage();
  const { isSmallScreen, isVerySmallScreen, scaleSize } = useResponsive();
  const {
    items,
    updateQuantity,
    removeItem,
    subtotal,
    tax,
    total,
    clearCart,
    prepareOrder,
    isOrderRequestCurrent,
    isEmpty,
    itemCount,
  } = useContext(CartContext);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const availability = useMenuAvailability(restaurantId, navigation);
  // Cart rows are on sale unless the latest check (or a refusal) says not.
  const soldOut = (item) =>
    isSoldOut({ id: item.id, is_available: true }, availability);
  const hasSoldOut = items.some(soldOut);
  const orderingClosed = ["paused", "invalid"].includes(availability.ordering);
  // One order holds at most MAX_ORDER_TOTAL_QUANTITY items across its lines;
  // the server refuses more (docs/order_api.md).
  const totalFull = itemCount >= MAX_ORDER_TOTAL_QUANTITY;
  const tooMany = itemCount > MAX_ORDER_TOTAL_QUANTITY;
  const cannotOrder = hasSoldOut || orderingClosed || tooMany;

  // テキスト取得用ヘルパー
  const t = (ja, en, zh) => {
    if (currentLanguage === "zh") return zh;
    if (currentLanguage === "en") return en;
    return ja;
  };

  // カートアイテムの名前を現在の言語で取得
  const getItemDisplayName = (item) =>
    translationDisplay(item, "name", currentLanguage, translationMode);

  // 数量変更
  const handleQuantityChange = (item, delta) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity > MAX_ORDER_QUANTITY || (delta > 0 && totalFull)) return;
    if (newQuantity <= 0) {
      handleRemoveItem(item);
    } else {
      updateQuantity(item.id, newQuantity, item.notes);
    }
  };

  // 商品削除
  const handleRemoveItem = (item) => {
    const displayName = getItemDisplayName(item);
    showAlert(
      t("削除確認", "Confirm Removal", "确认删除"),
      t(
        `「${displayName}」をカートから削除しますか？`,
        `Remove "${displayName}" from cart?`,
        `从购物车中删除"${displayName}"吗？`
      ),
      [
        {
          text: t("キャンセル", "Cancel", "取消"),
          style: "cancel",
        },
        {
          text: t("削除", "Remove", "删除"),
          style: "destructive",
          onPress: () => removeItem(item.id, item.notes),
        },
      ]
    );
  };

  // 注文を確定
  const handleSubmitOrder = async () => {
    if (isEmpty || submitting.current || cannotOrder) return;

    showAlert(
      t("注文確認", "Confirm Order", "确认订单"),
      t(
        `合計 ${yen(total)}${taxLabel("ja")}で注文を確定しますか？`,
        `Place this order for ${yen(total)}${taxLabel("en")}?`,
        `确认以合计 ${yen(total)}${taxLabel("zh")}下单吗？`
      ),
      [
        {
          text: t("キャンセル", "Cancel", "取消"),
          style: "cancel",
        },
        {
          text: t("注文する", "Place Order", "下单"),
          onPress: () => submitOrder(),
        },
      ]
    );
  };

  const submitOrder = async () => {
    if (submitting.current || isEmpty || cannotOrder) return;
    submitting.current = true;
    setIsSubmitting(true);
    let requestId;

    try {
      const orderData = {
        restaurantId,
        tableId,
        customerLanguage: currentLanguage,
        items: items.map((item) => ({
          item_id: item.id,
          name: item.name,
          name_ja: item.name_ja,
          name_en: item.name_en,
          name_zh: item.name_zh,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || null,
        })),
        subtotal,
        tax,
        totalAmount: total,
        ...(table?.token ? { tableToken: table.token } : {}),
      };

      // A retry of the same content resends the first payload and request ID.
      const payload = await prepareOrder(orderData);
      requestId = payload.requestId;

      const result = await createOrder(payload);
      if (!isOrderRequestCurrent(requestId)) return;

      clearCart();

      navigation.navigate("OrderComplete", {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        total,
        restaurantId,
        tableId,
        restaurant,
        table,
      });
    } catch (error) {
      if (requestId && !isOrderRequestCurrent(requestId)) return;
      console.error("Order submission error:", error);
      if (error.details?.reason === "price_changed") {
        showAlert(
          t("メニュー更新が必要です", "Menu update needed", "请更新菜单"),
          t(
            "商品価格が変更されました。メニューを更新し、商品を選び直してください。",
            "Prices have changed. Refresh the menu and choose your items again.",
            "商品价格已变更。请更新菜单并重新选择商品。"
          ),
          [
            {
              text: t("メニューへ", "Open menu", "打开菜单"),
              onPress: () => {
                if (!isOrderRequestCurrent(requestId)) return;
                clearCart();
                navigation.replace("Menu", {
                  restaurantId,
                  tableId,
                  restaurant,
                  table,
                });
              },
            },
          ]
        );
        return;
      }

      const reason = error.details?.reason;
      // The cart changed after a send with an unknown result: the hook asked
      // about that order first and did not send this one. The notice above
      // the cart shows the same result and its actions.
      if (reason === "previous_order_accepted") {
        showAlert(
          t(
            "前回の注文は受付済みです",
            "Your last order was received",
            "上次的订单已受理"
          ),
          t(
            "前回の注文は、変更前の内容で受け付けられていました。新しい注文は送信していません。受付済みの商品はカートから除きました。カートに残った商品は、追加の注文として確定できます。",
            "Your last order was received as it was before your changes. No new order was sent. The items already ordered were removed from your cart. Anything left in the cart can be placed as an additional order.",
            "上次的订单已按修改前的内容受理。未提交新订单。已受理的商品已从购物车中移除。购物车中剩余的商品可作为追加订单提交。"
          )
        );
        return;
      }
      if (reason === "previous_order_unconfirmed") {
        showAlert(
          t(
            "前回の注文を確認できません",
            "Could not check your last order",
            "无法确认上次的订单"
          ),
          t(
            "前回の注文の受付状況を確認できないため、新しい注文は送信していません。通信を確認して、もう一度「注文を確定する」を押してください。確認できない場合はスタッフへお声がけください。カートはそのまま残ります。",
            "We could not check whether your last order was received, so no new order was sent. Check your connection and tap Place Order again. If this keeps happening, please ask our staff. Your cart is kept.",
            "无法确认上次的订单是否已受理，因此未提交新订单。请检查网络后再次点击下单。如仍无法确认，请联系店员。购物车将保留。"
          )
        );
        return;
      }
      if (reason === "item_unavailable" && error.details.itemId) {
        availability.markSoldOut(error.details.itemId);
        showAlert(
          t("売り切れの商品があります", "Item sold out", "有商品已售罄"),
          t(
            "売り切れの商品をカートから削除してから、もう一度注文してください。注文は送信されていません。",
            "Remove the sold-out item from your cart and order again. Nothing was ordered.",
            "请从购物车中删除已售罄的商品后重新下单。订单未提交。"
          )
        );
        return;
      }
      if (reason === "table_token_invalid") {
        showAlert(
          t(
            "QRコードを読み取り直してください",
            "Scan the QR code again",
            "请重新扫描二维码"
          ),
          t(
            "テーブルのQRコードを確認できませんでした。テーブルのQRコードを読み取り直すか、スタッフへお声がけください。注文は送信されていません。",
            "We could not confirm this table's QR code. Scan the QR code on your table again or ask our staff. Nothing was ordered.",
            "无法确认餐桌二维码。请重新扫描餐桌上的二维码或联系店员。订单未提交。"
          )
        );
        return;
      }
      if (reason === "rate_limited") {
        const minutes = Math.max(
          1,
          Math.ceil((error.details.retryAfterSeconds || 60) / 60)
        );
        showAlert(
          t("しばらくお待ちください", "Please wait", "请稍候"),
          t(
            `短時間に多くの注文が送信されたため、受付を一時的に制限しています。約${minutes}分後にもう一度お試しいただくか、スタッフへお声がけください。注文は送信されていません。`,
            `Many orders were sent in a short time, so ordering is briefly limited. Please try again in about ${minutes} min or ask our staff. Nothing was ordered.`,
            `短时间内提交了大量订单，暂时限制下单。请约${minutes}分钟后重试或联系店员。订单未提交。`
          )
        );
        return;
      }
      if (reason === "ordering_paused" || reason === "ordering_unconfigured") {
        availability.refresh();
        showAlert(
          t("注文受付を停止中です", "Ordering paused", "暂停接单"),
          t(
            "現在、注文受付を一時停止しています。スタッフへお声がけください。カートはそのまま残ります。",
            "We are not taking new orders right now. Please ask our staff. Your cart is kept.",
            "目前暂停接受新订单。请联系店员。购物车将保留。"
          )
        );
        return;
      }
      // Without a definite answer from the server the order may have been
      // received; resending the same cart is safe because it reuses the ID.
      const rejected = [
        "invalid-argument",
        "failed-precondition",
        "not-found",
        "already-exists",
      ].some((code) => error.code?.endsWith(code));
      showAlert(
        t("エラー", "Error", "错误"),
        rejected
          ? t(
              "注文を受け付けられませんでした。内容を確認してください。",
              "The order could not be accepted. Please check your cart.",
              "无法受理订单。请确认购物车内容。"
            )
          : t(
              "注文の結果を確認できませんでした。通信を確認して、もう一度「注文を確定する」を押してください。同じ内容なら注文は重複しません。",
              "We could not confirm your order. Check your connection and tap Place Order again. The same cart will not be ordered twice.",
              "无法确认订单结果。请检查网络后再次点击下单。相同内容不会重复下单。"
            )
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  // レスポンシブなサイズ計算
  const imageSize = scaleSize(60, 48, 70);
  // 44px on every screen size, the minimum touch target.
  const quantityButtonSize = 44;
  const removeButtonSize = 44;

  // カートアイテムをレンダリング
  const renderCartItem = ({ item }) => (
    <View style={[styles.cartItem, isVerySmallScreen && styles.cartItemSmall]}>
      {/* 画像 */}
      <MenuImage
        uri={item.image_url}
        style={[styles.itemImage, { width: imageSize, height: imageSize }]}
        placeholderSize={scaleSize(24, 18, 28)}
      />

      {/* 商品情報 */}
      <View style={styles.itemInfo}>
        <Text
          style={[styles.itemName, isSmallScreen && styles.itemNameSmall]}
          numberOfLines={2}
        >
          {getItemDisplayName(item)}
        </Text>
        {/* 行の金額（税込）。足すとフッターの合計になる。 */}
        <Text
          style={[styles.itemPrice, isSmallScreen && styles.itemPriceSmall]}
        >
          {yen(taxIncluded(item.price, item.quantity))}
          {item.quantity > 1 && (
            <Text style={styles.itemUnitPrice}>
              {`  ${yen(taxIncluded(item.price))} × ${item.quantity}`}
            </Text>
          )}
        </Text>
        {item.quantity >= MAX_ORDER_QUANTITY && (
          <Text accessibilityLiveRegion="polite" style={styles.itemNotes}>
            {t(
              `上限${MAX_ORDER_QUANTITY}個`,
              `Maximum ${MAX_ORDER_QUANTITY} items`,
              `最多${MAX_ORDER_QUANTITY}份`
            )}
          </Text>
        )}
        {item.notes && (
          <Text style={styles.itemNotes} numberOfLines={1}>
            📝 {item.notes}
          </Text>
        )}
        {soldOut(item) && (
          <Text accessibilityLiveRegion="polite" style={styles.soldOutNote}>
            {t(
              "売り切れのため注文できません。カートから削除してください。",
              "Sold out. Please remove it from your cart.",
              "已售罄，请从购物车中删除。"
            )}
          </Text>
        )}
      </View>

      {/* 数量コントロール */}
      <View style={styles.quantityControl}>
        <TouchableOpacity
          style={[
            styles.quantityButton,
            {
              width: quantityButtonSize,
              height: quantityButtonSize,
              borderRadius: quantityButtonSize / 2,
            },
          ]}
          onPress={() => handleQuantityChange(item, -1)}
          accessibilityRole="button"
          accessibilityLabel={t(
            "数量を減らす",
            "Decrease quantity",
            "减少数量"
          )}
        >
          <Text
            style={[
              styles.quantityButtonText,
              { fontSize: scaleSize(18, 14, 20) },
            ]}
          >
            −
          </Text>
        </TouchableOpacity>

        <Text
          style={[
            styles.quantityText,
            isSmallScreen && styles.quantityTextSmall,
          ]}
        >
          {item.quantity}
        </Text>

        <TouchableOpacity
          style={[
            styles.quantityButton,
            {
              width: quantityButtonSize,
              height: quantityButtonSize,
              borderRadius: quantityButtonSize / 2,
            },
          ]}
          onPress={() => handleQuantityChange(item, 1)}
          disabled={
            item.quantity >= MAX_ORDER_QUANTITY ||
            totalFull ||
            isSubmitting ||
            soldOut(item)
          }
          accessibilityRole="button"
          accessibilityLabel={t(
            "数量を増やす",
            "Increase quantity",
            "增加数量"
          )}
          accessibilityState={{
            disabled:
              item.quantity >= MAX_ORDER_QUANTITY ||
              totalFull ||
              isSubmitting ||
              soldOut(item),
          }}
        >
          <Text
            style={[
              styles.quantityButtonText,
              (item.quantity >= MAX_ORDER_QUANTITY || totalFull) && {
                color: COLORS.disabled,
              },
              { fontSize: scaleSize(18, 14, 20) },
            ]}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>

      {/* 削除ボタン */}
      <TouchableOpacity
        style={[
          styles.removeButton,
          {
            width: removeButtonSize,
            height: removeButtonSize,
            borderRadius: removeButtonSize / 2,
          },
        ]}
        onPress={() => handleRemoveItem(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t(
          `${getItemDisplayName(item)}を削除`,
          `Remove ${getItemDisplayName(item)}`,
          `删除${getItemDisplayName(item)}`
        )}
      >
        <Text
          style={[styles.removeButtonText, { fontSize: scaleSize(22, 18, 24) }]}
        >
          ×
        </Text>
      </TouchableOpacity>
    </View>
  );

  const recoveryNotice = (
    <PendingOrderNotice
      navigation={navigation}
      session={{ restaurantId, tableId, restaurant, table }}
    />
  );

  // 空のカート
  if (isEmpty) {
    return (
      <SafeAreaView style={styles.container}>
        {recoveryNotice}
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon, { fontSize: scaleSize(80, 60, 80) }]}>
            🛒
          </Text>
          <Text
            style={[styles.emptyTitle, isSmallScreen && styles.emptyTitleSmall]}
          >
            {t("カートは空です", "Cart is empty", "购物车是空的")}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t(
              "メニューから商品を追加してください",
              "Add items from the menu",
              "请从菜单中添加商品"
            )}
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>
              {t("メニューに戻る", "Back to Menu", "返回菜单")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("戻る", "Back", "返回")}
            style={styles.headerBackButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.headerBackButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text
              style={[
                styles.headerTitle,
                isSmallScreen && styles.headerTitleSmall,
              ]}
            >
              {t("カート", "Cart", "购物车")}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t("テーブル", "Table", "桌号")} {table?.table_number || tableId}
            </Text>
          </View>
        </View>
      </View>
      {recoveryNotice}
      <OrderingNotice availability={availability} />

      {/* カートリスト */}
      <FlatList
        data={items}
        extraData={availability.soldOut}
        renderItem={renderCartItem}
        keyExtractor={(item, index) => `${item.id}-${item.notes}-${index}`}
        contentContainerStyle={[
          styles.cartList,
          isSmallScreen && styles.cartListSmall,
        ]}
      />

      {/* 注文ボタンエリア */}
      <View
        style={[
          styles.summaryContainer,
          isSmallScreen && styles.summaryContainerSmall,
        ]}
      >
        {totalFull && (
          <Text
            accessibilityLiveRegion="polite"
            style={tooMany ? styles.soldOutNote : styles.itemNotes}
          >
            {t(
              `1回の注文は合計${MAX_ORDER_TOTAL_QUANTITY}個までです（カート内${itemCount}個）`,
              `One order can have up to ${MAX_ORDER_TOTAL_QUANTITY} items (${itemCount} in cart)`,
              `每次订单最多${MAX_ORDER_TOTAL_QUANTITY}份（购物车内${itemCount}份）`
            )}
            {tooMany &&
              t(
                "。数量を減らしてください。",
                ". Please reduce the quantities.",
                "。请减少数量。"
              )}
          </Text>
        )}
        <View style={styles.totalRow}>
          <Text
            style={[styles.totalLabel, isSmallScreen && styles.totalLabelSmall]}
          >
            {t("合計（税込）", "Total (incl. tax)", "合计（含税）")}
          </Text>
          <Text
            style={[styles.totalValue, isSmallScreen && styles.totalValueSmall]}
          >
            {yen(total)}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (isSubmitting || cannotOrder) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitOrder}
          disabled={isSubmitting || cannotOrder}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting || cannotOrder }}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <Text
              style={[
                styles.submitButtonText,
                isSmallScreen && styles.submitButtonTextSmall,
              ]}
            >
              {t("注文を確定する", "Place Order", "确认订单")}
            </Text>
          )}
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
  header: {
    backgroundColor: COLORS.primary,
    padding: 15,
    paddingTop: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerBackButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerBackButtonText: {
    fontSize: 28,
    color: COLORS.surface,
    fontWeight: "bold",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "bold",
    color: COLORS.surface,
  },
  headerTitleSmall: {
    fontSize: FONT_SIZES.lg,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.surface,
    opacity: 0.9,
  },
  cartList: {
    padding: 15,
  },
  cartListSmall: {
    padding: 10,
  },
  cartItem: {
    flexDirection: "row",
    // On the narrowest phones the 44px buttons wrap below the name.
    flexWrap: "wrap",
    rowGap: 8,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cartItemSmall: {
    padding: 8,
    marginBottom: 8,
  },
  itemImage: {
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
    minWidth: 96,
    marginLeft: 10,
    marginRight: 5,
  },
  itemName: {
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    color: COLORS.text,
  },
  itemNameSmall: {
    fontSize: FONT_SIZES.sm,
  },
  itemPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    color: COLORS.primary,
    marginTop: 2,
  },
  itemPriceSmall: {
    fontSize: FONT_SIZES.sm,
  },
  itemUnitPrice: {
    fontSize: FONT_SIZES.xs,
    fontWeight: "normal",
    color: COLORS.textSecondary,
  },
  soldOutNote: { color: "#B71C1C", fontWeight: "700", marginTop: 4 },
  itemNotes: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  quantityText: {
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    color: COLORS.text,
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: "center",
  },
  quantityTextSmall: {
    marginHorizontal: 5,
    fontSize: FONT_SIZES.sm,
  },
  removeButton: {
    backgroundColor: "#FFE5E5",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  removeButtonText: {
    color: "#B71C1C",
    fontWeight: "bold",
    lineHeight: 24,
  },
  summaryContainer: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  summaryContainerSmall: {
    padding: 15,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
    color: COLORS.text,
  },
  totalLabelSmall: {
    fontSize: FONT_SIZES.md,
  },
  totalValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  totalValueSmall: {
    fontSize: FONT_SIZES.xl,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
  },
  submitButtonTextSmall: {
    fontSize: FONT_SIZES.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 10,
  },
  emptyTitleSmall: {
    fontSize: FONT_SIZES.xl,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  backButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
});

export default CartScreen;
