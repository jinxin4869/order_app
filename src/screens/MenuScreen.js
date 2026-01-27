// メニュー画面
import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { COLORS, FONT_SIZES, ALLERGENS } from "../constants";
import { useLanguage } from "../hooks/useLanguage";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { getMenuWithTranslation } from "../services/api";

const MenuScreen = ({ navigation, route }) => {
  const { restaurantId, tableId, restaurant, table } = route.params;
  const { currentLanguage, getItemName, getItemDescription, getCategoryName } =
    useLanguage();
  const { isOnline } = useNetworkStatus();

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // メニューを読み込み
  const loadMenu = useCallback(
    async (showRefresh = false) => {
      console.log(
        `Loading menu for restaurant: ${restaurantId}, lang: ${currentLanguage}`
      );
      try {
        if (showRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        const result = await getMenuWithTranslation(
          restaurantId,
          currentLanguage
        );

        console.log(
          "Menu loaded successfully:",
          result.categories?.length,
          "categories"
        );

        setCategories(result.categories || []);
        setMenuItems(result.items || []);

        if (result.categories?.length > 0 && !selectedCategory) {
          setSelectedCategory(result.categories[0].id);
        }
      } catch (err) {
        console.error("Menu load error:", err);
        const errorMessage = err.message || "メニューの読み込みに失敗しました";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [restaurantId, currentLanguage, selectedCategory]
  );

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // カテゴリでフィルタリングされたメニュー
  const filteredItems = menuItems.filter(
    (item) => item.category_id === selectedCategory && item.is_available
  );

  // メニューアイテムをタップ
  const handleItemPress = (item) => {
    navigation.navigate("ItemDetail", {
      item,
      restaurantId,
      tableId,
    });
  };

  // カートを表示
  const handleCartPress = () => {
    navigation.navigate("Cart", {
      restaurantId,
      tableId,
      restaurant,
      table,
    });
  };

  // カテゴリタブをレンダリング
  const renderCategoryTab = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryTab,
        selectedCategory === item.id && styles.categoryTabActive,
      ]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <Text style={styles.categoryIcon}>{item.icon || "🍽️"}</Text>
      <Text
        style={[
          styles.categoryText,
          selectedCategory === item.id && styles.categoryTextActive,
        ]}
      >
        {getCategoryName(item)}
      </Text>
    </TouchableOpacity>
  );

  // メニューアイテムをレンダリング
  const renderMenuItem = ({ item }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => handleItemPress(item)}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
          <Text style={styles.placeholderText}>🍽️</Text>
        </View>
      )}

      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={2}>
            {getItemName(item)}
          </Text>
          {item.is_popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>人気</Text>
            </View>
          )}
        </View>

        <Text style={styles.itemDescription} numberOfLines={2}>
          {getItemDescription(item)}
        </Text>

        {/* アレルゲン表示 */}
        {item.allergens?.length > 0 && (
          <View style={styles.allergenContainer}>
            {item.allergens.slice(0, 4).map((allergen) => (
              <Text key={allergen} style={styles.allergenIcon}>
                {ALLERGENS[allergen]?.icon || "⚠️"}
              </Text>
            ))}
            {item.allergens.length > 4 && (
              <Text style={styles.moreAllergens}>
                +{item.allergens.length - 4}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // ローディング表示
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>メニューを読み込み中...</Text>
      </View>
    );
  }

  // エラー表示
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>😔</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadMenu()}>
          <Text style={styles.retryButtonText}>再読み込み</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.restaurantName}>
              {restaurant?.name || "レストラン"}
            </Text>
            <Text style={styles.tableInfo}>
              Table {table?.table_number || tableId}
            </Text>
          </View>
        </View>
      </View>

      {/* オフライン警告バナー */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📡 オフライン - ネットワーク接続を確認してください
          </Text>
        </View>
      )}

      {/* カテゴリタブ */}
      <FlatList
        data={categories}
        renderItem={renderCategoryTab}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryList}
        contentContainerStyle={styles.categoryListContent}
      />

      {/* メニューリスト */}
      <FlatList
        data={filteredItems}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.menuList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadMenu(true)}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              このカテゴリにはメニューがありません
            </Text>
          </View>
        }
      />

      {/* カートボタン */}
      <TouchableOpacity style={styles.cartButton} onPress={handleCartPress}>
        <Text style={styles.cartButtonText}>🛒 カートを見る</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 20,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: 15,
    paddingTop: 50,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 28,
    color: COLORS.surface,
    fontWeight: "bold",
  },
  headerTextContainer: {
    flex: 1,
  },
  restaurantName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "bold",
    color: COLORS.surface,
  },
  tableInfo: {
    fontSize: FONT_SIZES.md,
    color: COLORS.surface,
    opacity: 0.9,
  },
  offlineBanner: {
    backgroundColor: "#FF6B6B",
    padding: 12,
    alignItems: "center",
  },
  offlineBannerText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.sm,
    fontWeight: "bold",
  },
  categoryList: {
    backgroundColor: COLORS.surface,
    height: 80,
    flexShrink: 0,
  },
  categoryListContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  categoryTab: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  categoryTabActive: {
    backgroundColor: COLORS.primary,
  },
  categoryIcon: {
    fontSize: 18,
    marginRight: 5,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    textAlign: "center",
  },
  categoryTextActive: {
    color: COLORS.surface,
    fontWeight: "bold",
  },
  menuList: {
    padding: 15,
    paddingBottom: 100,
  },
  menuItem: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 15,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImage: {
    width: 100,
    height: 100,
  },
  itemImagePlaceholder: {
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 30,
  },
  itemInfo: {
    flex: 1,
    padding: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemName: {
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    color: COLORS.text,
    flex: 1,
  },
  popularBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  popularText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.xs,
    fontWeight: "bold",
  },
  itemDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  allergenContainer: {
    flexDirection: "row",
    marginTop: 5,
  },
  allergenIcon: {
    fontSize: 14,
    marginRight: 3,
  },
  moreAllergens: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  cartButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  cartButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
  },
  loadingText: {
    marginTop: 15,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  errorIcon: {
    fontSize: 50,
    marginBottom: 15,
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
});

export default MenuScreen;
