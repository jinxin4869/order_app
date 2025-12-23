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
  SafeAreaView,
} from "react-native";
import { COLORS, FONT_SIZES, ALLERGENS } from "../constants";
import { useLanguage } from "../hooks/useLanguage";
import { CartContext } from "../navigation/AppNavigator";

const ItemDetailScreen = ({ navigation, route }) => {
  const { item } = route.params;
  const { currentLanguage, getItemName, getItemDescription } = useLanguage();
  const { addItem } = useContext(CartContext);

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const itemName = getItemName(item);
  const itemDescription = getItemDescription(item);

  // 数量を増やす
  const incrementQuantity = () => {
    if (quantity < 99) {
      setQuantity(quantity + 1);
    }
  };

  // 数量を減らす
  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  // カートに追加
  const handleAddToCart = () => {
    addItem(
      {
        id: item.id,
        name: itemName,
        name_ja: item.name_ja,
        price: item.price,
        image_url: item.image_url,
      },
      quantity,
      notes
    );

    navigation.goBack();
  };

  // アレルゲン名を取得
  const getAllergenName = (allergenKey) => {
    const allergen = ALLERGENS[allergenKey];
    if (!allergen) return allergenKey;
    return allergen[currentLanguage] || allergen.ja || allergenKey;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 画像 */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>🍽️</Text>
          </View>
        )}

        {/* 商品情報 */}
        <View style={styles.content}>
          {/* 名前と価格 */}
          <View style={styles.header}>
            <Text style={styles.name}>{itemName}</Text>
            {item.is_popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>
                  {currentLanguage === "ja" ? "人気" : 
                   currentLanguage === "zh" ? "人气" : "Popular"}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.price}>¥{item.price.toLocaleString()}</Text>

          {/* 説明 */}
          {itemDescription && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {currentLanguage === "ja" ? "説明" : 
                 currentLanguage === "zh" ? "说明" : "Description"}
              </Text>
              <Text style={styles.description}>{itemDescription}</Text>
            </View>
          )}

          {/* アレルゲン情報 */}
          {item.allergens?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {currentLanguage === "ja" ? "アレルゲン情報" : 
                  : currentLanguage === "zh"
                    ? "过敏原信息"
                    : "Allergen Information"}
              </Text>
              <View style={styles.allergenList}>
                {item.allergens.map((allergen) => (
                  <View key={allergen} style={styles.allergenItem}>
                    <Text style={styles.allergenIcon}>
                      {ALLERGENS[allergen]?.icon || "⚠️"}
                    </Text>
                    <Text style={styles.allergenName}>
                      {getAllergenName(allergen)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 追加情報 */}
          <View style={styles.infoRow}>
            {item.cooking_time && (
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>⏱️</Text>
                <Text style={styles.infoText}>
                  {currentLanguage === "ja" ? `約${item.cooking_time}分` : 
                   currentLanguage === "zh" ? `约${item.cooking_time}分钟` : 
                      : `~${item.cooking_time} min`}
                </Text>
              </View>
            )}
            {item.calories && (
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>🔥</Text>
                <Text style={styles.infoText}>{item.calories} kcal</Text>
              </View>
            )}
            {item.spicy_level > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>🌶️</Text>
                <Text style={styles.infoText}>
                  {"🌶️".repeat(item.spicy_level)}
                </Text>
              </View>
            )}
          </View>

          {/* 特別リクエスト */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {currentLanguage === "ja" ? "ご要望（任意）" : 
               currentLanguage === "zh" ? "特殊要求（可选）" : "Special Requests (Optional)"}
            </Text>
            <TextInput
              style={styles.notesInput}
              placeholder={
                currentLanguage === "ja" ? "例: わさび抜き、少なめなど" : 
                currentLanguage === "zh" ? "例：不加芥末、少量等" : 
                "e.g., No wasabi, less spicy, etc."
              }
              placeholderTextColor={COLORS.disabled}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={200}
            />
          </View>
        </View>
      </ScrollView>

      {/* 注文バー */}
      <View style={styles.orderBar}>
        {/* 数量選択 */}
        <View style={styles.quantitySelector}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={decrementQuantity}
            disabled={quantity <= 1}
          >
            <Text
              style={[
                styles.quantityButtonText,
                quantity <= 1 && styles.quantityButtonDisabled,
              ]}
            >
              −
            </Text>
          </TouchableOpacity>

          <Text style={styles.quantityText}>{quantity}</Text>

          <TouchableOpacity
            style={styles.quantityButton}
            onPress={incrementQuantity}
            disabled={quantity >= 99}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* カートに追加ボタン */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
          <Text style={styles.addButtonText}>
            {currentLanguage === "ja" ? "カートに追加" : 
             currentLanguage === "zh" ? "加入购物车" : "Add to Cart"}
          </Text>
          <Text style={styles.addButtonPrice}>
            ¥{(item.price * quantity).toLocaleString()}
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
  scrollView: {
    flex: 1,
  },
  image: {
    width: "100%",
    height: 250,
    resizeMode: "cover",
  },
  imagePlaceholder: {
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 80,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  name: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    color: COLORS.text,
    flex: 1,
  },
  popularBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  popularText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.sm,
    fontWeight: "bold",
  },
  price: {
    fontSize: FONT_SIZES.title,
    fontWeight: "bold",
    color: COLORS.primary,
    marginTop: 10,
  },
  section: {
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 10,
  },
  description: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  allergenList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
  allergenIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  allergenName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 20,
    gap: 15,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
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
  orderBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 15,
  },
  quantitySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 25,
    padding: 5,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    fontSize: FONT_SIZES.xl,
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
  addButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
  addButtonPrice: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
});

export default ItemDetailScreen;
