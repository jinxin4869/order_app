// カート画面
import React, { useContext, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, MAX_ORDER_QUANTITY } from "../constants";
import { useLanguage } from "../hooks/useLanguage";
import { useResponsive } from "../hooks/useResponsive";
import { CartContext } from "../context/CartContext";
import { translationDisplay } from "../utils/translationDisplay";
import { createOrder } from "../services/api";
import { showAlert } from "../utils/dialogs";
import PendingOrderNotice from "../components/PendingOrderNotice";
import OrderingNotice from "../components/OrderingNotice";
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
  } = useContext(CartContext);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const availability = useMenuAvailability(restaurantId, navigation);
  // Cart rows are on sale unless the latest check (or a refusal) says not.
  const soldOut = (item) =>
    isSoldOut({ id: item.id, is_available: true }, availability);
  const hasSoldOut = items.some(soldOut);
  const orderingClosed = ["paused", "invalid"].includes(availability.ordering);
  const cannotOrder = hasSoldOut || orderingClosed;

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
    if (newQuantity > MAX_ORDER_QUANTITY) return;
    if (newQuantity <= 0) {
      handleRemoveItem(item);
    } else {
      updateQuantity(item.id, newQuantity, item.notes);
    }
  };

  // 商品削除
  const handleRemoveItem = (item) => {
    console.log("handleRemoveItem called for:", item.id, item.notes);
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
          onPress: () => {
            console.log("Removing item:", item.id, item.notes);
            removeItem(item.id, item.notes);
          },
        },
      ]
    );
  };

  // 注文を確定
  const handleSubmitOrder = async () => {
    if (isEmpty || submitting.current || cannotOrder) return;

    showAlert(
      t("注文確認", "Confirm Order", "确认订单"),
      t("注文を確定しますか？", "Confirm order?", "确认订购吗？"),
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
  const quantityButtonSize = scaleSize(28, 24, 32);
  const removeButtonSize = scaleSize(36, 30, 40);

  // カートアイテムをレンダリング
  const renderCartItem = ({ item }) => (
    <View style={[styles.cartItem, isVerySmallScreen && styles.cartItemSmall]}>
      {/* 画像 */}
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={[styles.itemImage, { width: imageSize, height: imageSize }]}
        />
      ) : (
        <View
          style={[
            styles.itemImage,
            styles.imagePlaceholder,
            { width: imageSize, height: imageSize },
          ]}
        >
          <Text
            style={[
              styles.placeholderText,
              { fontSize: scaleSize(24, 18, 28) },
            ]}
          >
            🍽️
          </Text>
        </View>
      )}

      {/* 商品情報 */}
      <View style={styles.itemInfo}>
        <Text
          style={[styles.itemName, isSmallScreen && styles.itemNameSmall]}
          numberOfLines={2}
        >
          {getItemDisplayName(item)}
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
            item.quantity >= MAX_ORDER_QUANTITY || isSubmitting || soldOut(item)
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
              isSubmitting ||
              soldOut(item),
          }}
        >
          <Text
            style={[
              styles.quantityButtonText,
              item.quantity >= MAX_ORDER_QUANTITY && { color: COLORS.disabled },
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
        onPress={() => {
          console.log("Delete button pressed!");
          handleRemoveItem(item);
        }}
        activeOpacity={0.7}
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
              Table {table?.table_number || tableId}
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
    width: 40,
    height: 40,
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
  imagePlaceholder: {
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
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
    marginLeft: 6,
  },
  removeButtonText: {
    color: "#FF6B6B",
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
