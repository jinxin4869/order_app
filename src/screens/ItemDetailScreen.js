// 商品詳細画面
import React, { useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  COLORS,
  FONT_SIZES,
  ALLERGENS,
  MIN_ORDER_QUANTITY,
  MAX_ORDER_QUANTITY,
} from "../constants";
import { useLanguage } from "../hooks/useLanguage";
import { useResponsive } from "../hooks/useResponsive";
import { CartContext } from "../context/CartContext";
import { showAlert } from "../utils/dialogs";

const ItemDetailScreen = ({ navigation, route }) => {
  const { item, restaurantId, tableId } = route.params;
  const { currentLanguage, getItemName, getItemDescription } = useLanguage();
  const { addItem, items = [] } = useContext(CartContext);
  const { isSmallScreen, scaleSize } = useResponsive();

  const [quantity, setQuantity] = useState(MIN_ORDER_QUANTITY);
  const [notes, setNotes] = useState("");

  const existingQuantity =
    items.find((entry) => entry.id === item.id && entry.notes === notes)
      ?.quantity || 0;
  const remaining = Math.max(0, MAX_ORDER_QUANTITY - existingQuantity);
  const selectedQuantity = Math.min(
    quantity,
    Math.max(MIN_ORDER_QUANTITY, remaining)
  );
  const handleNotesChange = (value) => {
    setNotes(value);
    const existing =
      items.find((entry) => entry.id === item.id && entry.notes === value)
        ?.quantity || 0;
    setQuantity((current) =>
      Math.min(
        current,
        Math.max(MIN_ORDER_QUANTITY, MAX_ORDER_QUANTITY - existing)
      )
    );
  };

  const itemName = getItemName(item);
  const itemDescription = getItemDescription(item);

  // 数量を増やす
  const incrementQuantity = () => {
    if (selectedQuantity < remaining) {
      setQuantity(selectedQuantity + 1);
    }
  };

  // 数量を減らす
  const decrementQuantity = () => {
    if (selectedQuantity > MIN_ORDER_QUANTITY) {
      setQuantity(selectedQuantity - 1);
    }
  };

  // カートに追加
  const handleAddToCart = () => {
    const added = addItem(
      {
        id: item.id,
        name: itemName,
        name_ja: item.name_ja,
        name_en: item.name_en,
        name_zh: item.name_zh,
        name_en_nodic: item.name_en_nodic,
        name_zh_nodic: item.name_zh_nodic,
        name_en_translation: item.name_en_translation,
        name_zh_translation: item.name_zh_translation,
        name_en_nodic_translation: item.name_en_nodic_translation,
        name_zh_nodic_translation: item.name_zh_nodic_translation,
        price: item.price,
        image_url: item.image_url,
      },
      selectedQuantity,
      notes,
      { restaurantId, tableId }
    );

    if (added === false) {
      showAlert(
        "カートに追加できません / Unable to add / 无法添加",
        "テーブルが変更されています。QRから開き直してください。 / Your table has changed. Open the QR link again. / 餐桌已变更，请重新打开二维码链接。"
      );
      return;
    }
    navigation.goBack();
  };

  // アレルゲン名を取得
  const getAllergenName = (allergenKey) => {
    const allergen = ALLERGENS[allergenKey];
    if (!allergen) return allergenKey;
    return allergen[currentLanguage] || allergen.ja || allergenKey;
  };

  // レスポンシブなサイズ
  const imageHeight = scaleSize(250, 180, 280);
  const quantityButtonSize = scaleSize(36, 30, 40);

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={[styles.header, isSmallScreen && styles.headerSmall]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, isSmallScreen && styles.headerTitleSmall]}
          numberOfLines={1}
        >
          {currentLanguage === "ja"
            ? "商品詳細"
            : currentLanguage === "zh"
              ? "商品详情"
              : "Details"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* 画像 */}
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={[styles.image, { height: imageHeight }]}
          />
        ) : (
          <View
            style={[
              styles.image,
              styles.imagePlaceholder,
              { height: imageHeight },
            ]}
          >
            <Text
              style={[
                styles.placeholderText,
                { fontSize: scaleSize(80, 60, 90) },
              ]}
            >
              🍽️
            </Text>
          </View>
        )}

        {/* 商品情報 */}
        <View style={[styles.content, isSmallScreen && styles.contentSmall]}>
          {/* 名前と価格 */}
          <View style={styles.itemHeader}>
            <Text
              style={[styles.name, isSmallScreen && styles.nameSmall]}
              numberOfLines={3}
            >
              {itemName}
            </Text>
            {item.is_popular && (
              <View
                style={[
                  styles.popularBadge,
                  isSmallScreen && styles.popularBadgeSmall,
                ]}
              >
                <Text
                  style={[
                    styles.popularText,
                    isSmallScreen && styles.popularTextSmall,
                  ]}
                >
                  {currentLanguage === "ja"
                    ? "人気"
                    : currentLanguage === "zh"
                      ? "人气"
                      : "Popular"}
                </Text>
              </View>
            )}
          </View>

          {/* 説明 */}
          {itemDescription && (
            <View
              style={[styles.section, isSmallScreen && styles.sectionSmall]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  isSmallScreen && styles.sectionTitleSmall,
                ]}
              >
                {currentLanguage === "ja"
                  ? "説明"
                  : currentLanguage === "zh"
                    ? "说明"
                    : "Description"}
              </Text>
              <Text
                style={[
                  styles.description,
                  isSmallScreen && styles.descriptionSmall,
                ]}
              >
                {itemDescription}
              </Text>
            </View>
          )}

          {/* アレルゲン情報 */}
          {item.allergens?.length > 0 && (
            <View
              style={[styles.section, isSmallScreen && styles.sectionSmall]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  isSmallScreen && styles.sectionTitleSmall,
                ]}
              >
                {currentLanguage === "ja"
                  ? "アレルゲン情報"
                  : currentLanguage === "zh"
                    ? "过敏原信息"
                    : "Allergen Information"}
              </Text>
              <View style={styles.allergenList}>
                {item.allergens.map((allergen) => (
                  <View
                    key={allergen}
                    style={[
                      styles.allergenItem,
                      isSmallScreen && styles.allergenItemSmall,
                    ]}
                  >
                    <Text
                      style={[
                        styles.allergenIcon,
                        isSmallScreen && styles.allergenIconSmall,
                      ]}
                    >
                      {ALLERGENS[allergen]?.icon || "⚠️"}
                    </Text>
                    <Text
                      style={[
                        styles.allergenName,
                        isSmallScreen && styles.allergenNameSmall,
                      ]}
                    >
                      {getAllergenName(allergen)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 調理時間 */}
          {item.cooking_time && (
            <View
              style={[styles.section, isSmallScreen && styles.sectionSmall]}
            >
              <View
                style={[styles.infoItem, isSmallScreen && styles.infoItemSmall]}
              >
                <Text style={styles.infoIcon}>⏱️</Text>
                <Text
                  style={[
                    styles.infoText,
                    isSmallScreen && styles.infoTextSmall,
                  ]}
                >
                  {currentLanguage === "ja"
                    ? `調理時間: 約${item.cooking_time}分`
                    : currentLanguage === "zh"
                      ? `烹饪时间: 约${item.cooking_time}分钟`
                      : `Cooking time: ~${item.cooking_time} min`}
                </Text>
              </View>
            </View>
          )}

          {existingQuantity > 0 && (
            <Text accessibilityLiveRegion="polite" style={styles.infoText}>
              {currentLanguage === "ja"
                ? `同じ商品・備考は${MAX_ORDER_QUANTITY}個まで（カート内${existingQuantity}個）`
                : currentLanguage === "zh"
                  ? `同一商品与备注最多${MAX_ORDER_QUANTITY}份（购物车内${existingQuantity}份）`
                  : `Maximum ${MAX_ORDER_QUANTITY} for the same item and notes (${existingQuantity} in cart)`}
            </Text>
          )}

          {/* 特別リクエスト */}
          <View style={[styles.section, isSmallScreen && styles.sectionSmall]}>
            <Text
              style={[
                styles.sectionTitle,
                isSmallScreen && styles.sectionTitleSmall,
              ]}
            >
              {currentLanguage === "ja"
                ? "ご要望（任意）"
                : currentLanguage === "zh"
                  ? "特殊要求（可选）"
                  : "Special Requests (Optional)"}
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                isSmallScreen && styles.notesInputSmall,
              ]}
              placeholder={
                currentLanguage === "ja"
                  ? "例: わさび抜き、少なめなど"
                  : currentLanguage === "zh"
                    ? "例：不加芥末、少量等"
                    : "e.g., No wasabi, less spicy, etc."
              }
              placeholderTextColor={COLORS.disabled}
              value={notes}
              onChangeText={handleNotesChange}
              multiline
              maxLength={200}
            />
          </View>
        </View>
      </ScrollView>

      {/* 注文バー */}
      <View style={[styles.orderBar, isSmallScreen && styles.orderBarSmall]}>
        {/* 数量選択 */}
        <View
          style={[
            styles.quantitySelector,
            isSmallScreen && styles.quantitySelectorSmall,
          ]}
        >
          <TouchableOpacity
            style={[
              styles.quantityButton,
              {
                width: quantityButtonSize,
                height: quantityButtonSize,
                borderRadius: quantityButtonSize / 2,
              },
            ]}
            onPress={decrementQuantity}
            disabled={selectedQuantity <= MIN_ORDER_QUANTITY}
          >
            <Text
              style={[
                styles.quantityButtonText,
                selectedQuantity <= MIN_ORDER_QUANTITY &&
                  styles.quantityButtonDisabled,
                { fontSize: scaleSize(FONT_SIZES.xl, 16, 22) },
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
            {selectedQuantity}
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
            onPress={incrementQuantity}
            disabled={selectedQuantity >= remaining}
          >
            <Text
              style={[
                styles.quantityButtonText,
                { fontSize: scaleSize(FONT_SIZES.xl, 16, 22) },
              ]}
            >
              +
            </Text>
          </TouchableOpacity>
        </View>

        {/* カートに追加ボタン */}
        <TouchableOpacity
          style={[
            styles.addButton,
            isSmallScreen && styles.addButtonSmall,
            remaining === 0 && { opacity: 0.5 },
          ]}
          disabled={remaining === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: remaining === 0 }}
          onPress={handleAddToCart}
        >
          <Text
            style={[
              styles.addButtonText,
              isSmallScreen && styles.addButtonTextSmall,
            ]}
          >
            {currentLanguage === "ja"
              ? "カートに追加"
              : currentLanguage === "zh"
                ? "加入购物车"
                : "Add to Cart"}
          </Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  headerSmall: {
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 28,
    color: COLORS.surface,
    fontWeight: "bold",
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
    color: COLORS.surface,
    flex: 1,
    textAlign: "center",
  },
  headerTitleSmall: {
    fontSize: FONT_SIZES.md,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  image: {
    width: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    // fontSize set dynamically
  },
  content: {
    padding: 20,
  },
  contentSmall: {
    padding: 15,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  name: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    color: COLORS.text,
    flex: 1,
  },
  nameSmall: {
    fontSize: FONT_SIZES.xl,
  },
  popularBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
    marginTop: 4,
  },
  popularBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  popularText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.sm,
    fontWeight: "bold",
  },
  popularTextSmall: {
    fontSize: FONT_SIZES.xs,
  },
  section: {
    marginTop: 25,
  },
  sectionSmall: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 10,
  },
  sectionTitleSmall: {
    fontSize: FONT_SIZES.sm,
    marginBottom: 8,
  },
  description: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  descriptionSmall: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  allergenList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  allergenItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  allergenItemSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  allergenIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  allergenIconSmall: {
    fontSize: 14,
    marginRight: 4,
  },
  allergenName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  allergenNameSmall: {
    fontSize: FONT_SIZES.xs,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: "flex-start",
  },
  infoItemSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  infoTextSmall: {
    fontSize: FONT_SIZES.xs,
  },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 15,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notesInputSmall: {
    padding: 12,
    fontSize: FONT_SIZES.sm,
    minHeight: 70,
  },
  orderBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  orderBarSmall: {
    padding: 10,
    gap: 8,
  },
  quantitySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 25,
    padding: 5,
  },
  quantitySelectorSmall: {
    padding: 3,
  },
  quantityButton: {
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  quantityButtonDisabled: {
    color: COLORS.disabled,
  },
  quantityText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
    color: COLORS.text,
    marginHorizontal: 15,
    minWidth: 30,
    textAlign: "center",
  },
  quantityTextSmall: {
    fontSize: FONT_SIZES.md,
    marginHorizontal: 10,
    minWidth: 24,
  },
  addButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    padding: 15,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonSmall: {
    padding: 12,
  },
  addButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
  addButtonTextSmall: {
    fontSize: FONT_SIZES.sm,
  },
});

export default ItemDetailScreen;
