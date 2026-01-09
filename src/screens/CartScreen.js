// カート画面
import React, { useContext, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { COLORS, FONT_SIZES } from "../constants";
import { useLanguage } from "../hooks/useLanguage";
import { CartContext } from "../navigation/AppNavigator";
import { createOrder } from "../services/api";

const CartScreen = ({ navigation, route }) => {
  const { restaurantId, tableId, restaurant, table } = route.params;
  const { currentLanguage } = useLanguage();
  const {
    items,
    updateQuantity,
    removeItem,
    subtotal,
    tax,
    total,
    clearCart,
    isEmpty,
  } = useContext(CartContext);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // テキスト取得用ヘルパー
  const t = (ja, en, zh) => {
    if (currentLanguage === "zh") return zh;
    if (currentLanguage === "en") return en;
    return ja;
  };

  // 数量変更
  const handleQuantityChange = (item, delta) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      handleRemoveItem(item);
    } else {
      updateQuantity(item.id, newQuantity, item.notes);
    }
  };

  // 商品削除
  const handleRemoveItem = (item) => {
    Alert.alert(
      t("削除確認", "Confirm Removal", "确认删除"),
      t(
        `「${item.name}」をカートから削除しますか？`,
        `Remove "${item.name}" from cart?`,
        `从购物车中删除"${item.name}"吗？`
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
    if (isEmpty) return;

    Alert.alert(
      t("注文確認", "Confirm Order", "确认订单"),
      t(
        `合計 ¥${total.toLocaleString()} で注文を確定しますか？`,
        `Confirm order for ¥${total.toLocaleString()}?`,
        `确认订购总计 ¥${total.toLocaleString()} 吗？`
      ),
      [
        {
          text: t("キャンセル", "Cancel", "取消"),
          style: "cancel",
        },
        {
          text: t("注文する", "Place Order", "下单"),
          onPress: submitOrder,
        },
      ]
    );
  };

  const submitOrder = async () => {
    setIsSubmitting(true);

    try {
      const orderData = {
        restaurantId,
        tableId,
        customerLanguage: currentLanguage,
        items: items.map((item) => ({
          item_id: item.id,
          name: item.name,
          name_ja: item.name_ja,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || null,
        })),
        subtotal,
        tax,
        totalAmount: total,
      };

      const result = await createOrder(orderData);

      clearCart();

      navigation.navigate("OrderComplete", {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        total,
        restaurant,
        table,
      });
    } catch (error) {
      console.error("Order submission error:", error);
      Alert.alert(
        t("エラー", "Error", "错误"),
        t(
          "注文の送信に失敗しました。もう一度お試しください。",
          "Failed to submit order. Please try again.",
          "订单提交失败，请重试。"
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // カートアイテムをレンダリング
  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, styles.imagePlaceholder]}>
          <Text style={styles.placeholderText}>🍽️</Text>
        </View>
      )}

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.notes && (
          <Text style={styles.itemNotes} numberOfLines={1}>
            📝 {item.notes}
          </Text>
        )}
        <Text style={styles.itemPrice}>¥{item.price.toLocaleString()}</Text>
      </View>

      <View style={styles.quantityControl}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleQuantityChange(item, -1)}
        >
          <Text style={styles.quantityButtonText}>−</Text>
        </TouchableOpacity>

        <Text style={styles.quantityText}>{item.quantity}</Text>

        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleQuantityChange(item, 1)}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveItem(item)}
      >
        <Text style={styles.removeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  // 空のカート
  if (isEmpty) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>
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
        <Text style={styles.headerTitle}>{t("カート", "Cart", "购物车")}</Text>
        <Text style={styles.headerSubtitle}>
          Table {table?.table_number || tableId}
        </Text>
      </View>

      {/* カートリスト */}
      <FlatList
        data={items}
        renderItem={renderCartItem}
        keyExtractor={(item, index) => `${item.id}-${item.notes}-${index}`}
        contentContainerStyle={styles.cartList}
      />

      {/* 合計エリア */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {t("小計", "Subtotal", "小计")}
          </Text>
          <Text style={styles.summaryValue}>¥{subtotal.toLocaleString()}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {t("消費税 (10%)", "Tax (10%)", "消费税 (10%)")}
          </Text>
          <Text style={styles.summaryValue}>¥{tax.toLocaleString()}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>{t("合計", "Total", "总计")}</Text>
          <Text style={styles.totalValue}>¥{total.toLocaleString()}</Text>
        </View>

        {/* 注文ボタン */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            isSubmitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitOrder}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <Text style={styles.submitButtonText}>
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
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "bold",
    color: COLORS.surface,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.surface,
    opacity: 0.9,
  },
  cartList: {
    padding: 15,
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
  itemImage: {
    width: 60,
    height: 60,
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
    marginLeft: 12,
  },
  itemName: {
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    color: COLORS.text,
  },
  itemNotes: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: "bold",
    marginTop: 4,
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    fontWeight: "bold",
  },
  quantityText: {
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    color: COLORS.text,
    marginHorizontal: 10,
    minWidth: 20,
    textAlign: "center",
  },
  removeButton: {
    padding: 5,
  },
  removeButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.disabled,
  },
  summaryContainer: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
    color: COLORS.text,
  },
  totalValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
    marginTop: 15,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 10,
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
