// メニュー画面
import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { useResponsive } from "../hooks/useResponsive";
import { getMenuWithTranslation } from "../services/api";

const RestaurantMenu = ({ navigation, route }) => {
  const { restaurantId, tableId, restaurant, table } = route.params;
  const {
    currentLanguage,
    getItemName,
    getItemDescription,
    getCategoryName,
    translationMode,
    setTranslationMode,
  } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const { isSmallScreen, isVerySmallScreen, scaleSize } = useResponsive();

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const requestVersion = useRef(0);
  // The API returns every language; category and language switches are local.
  const loadMenu = useCallback(
    async (showRefresh = false) => {
      const request = ++requestVersion.current;
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const result = await getMenuWithTranslation(restaurantId);
        if (request !== requestVersion.current) return;
        const nextCategories = result.categories || [];
        setCategories(nextCategories);
        setMenuItems(result.items || []);
        setSelectedCategory((previous) =>
          nextCategories.some((category) => category.id === previous)
            ? previous
            : nextCategories[0]?.id || null
        );
      } catch (failure) {
        if (request === requestVersion.current)
          setError(
            failure.message ||
              "メニューの読み込みに失敗しました / Failed to load menu / 菜单加载失败"
          );
      } finally {
        if (request === requestVersion.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [restaurantId]
  );
  useEffect(() => {
    loadMenu();
    const version = requestVersion;
    return () => {
      version.current++;
    };
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

  // レスポンシブなサイズ
  const itemImageSize = scaleSize(100, 70, 110);
  const categoryTabHeight = scaleSize(80, 65, 85);

  // カテゴリタブをレンダリング
  const renderCategoryTab = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryTab,
        selectedCategory === item.id && styles.categoryTabActive,
        isSmallScreen && styles.categoryTabSmall,
      ]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <Text
        style={[styles.categoryIcon, isSmallScreen && styles.categoryIconSmall]}
      >
        {item.icon || "🍽️"}
      </Text>
      <Text
        style={[
          styles.categoryText,
          selectedCategory === item.id && styles.categoryTextActive,
          isSmallScreen && styles.categoryTextSmall,
        ]}
        numberOfLines={1}
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
        <Image
          source={{ uri: item.image_url }}
          style={[
            styles.itemImage,
            { width: itemImageSize, height: itemImageSize },
          ]}
        />
      ) : (
        <View
          style={[
            styles.itemImage,
            styles.itemImagePlaceholder,
            { width: itemImageSize, height: itemImageSize },
          ]}
        >
          <Text
            style={[
              styles.placeholderText,
              { fontSize: scaleSize(30, 22, 32) },
            ]}
          >
            🍽️
          </Text>
        </View>
      )}

      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text
            style={[styles.itemName, isSmallScreen && styles.itemNameSmall]}
            numberOfLines={2}
          >
            {getItemName(item)}
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
                {currentLanguage === "zh"
                  ? "人气"
                  : currentLanguage === "en"
                    ? "Popular"
                    : "人気"}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={[
            styles.itemDescription,
            isSmallScreen && styles.itemDescriptionSmall,
          ]}
          numberOfLines={2}
        >
          {getItemDescription(item)}
        </Text>

        {/* アレルゲン表示 */}
        {item.allergens?.length > 0 && (
          <View style={styles.allergenContainer}>
            {item.allergens.slice(0, isSmallScreen ? 3 : 4).map((allergen) => (
              <Text
                key={allergen}
                style={[
                  styles.allergenIcon,
                  isSmallScreen && styles.allergenIconSmall,
                ]}
              >
                {ALLERGENS[allergen]?.icon || "⚠️"}
              </Text>
            ))}
            {item.allergens.length > (isSmallScreen ? 3 : 4) && (
              <Text style={styles.moreAllergens}>
                +{item.allergens.length - (isSmallScreen ? 3 : 4)}
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
        <Text style={styles.loadingText}>
          {currentLanguage === "zh"
            ? "正在加载菜单..."
            : currentLanguage === "en"
              ? "Loading menu..."
              : "メニューを読み込み中..."}
        </Text>
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
          <Text style={styles.retryButtonText}>
            {currentLanguage === "zh"
              ? "重新加载"
              : currentLanguage === "en"
                ? "Retry"
                : "再読み込み"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={[styles.header, isSmallScreen && styles.headerSmall]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text
              style={[
                styles.restaurantName,
                isSmallScreen && styles.restaurantNameSmall,
              ]}
              numberOfLines={1}
            >
              {restaurant?.name || "レストラン"}
            </Text>
            <Text style={styles.tableInfo}>
              Table {table?.table_number || tableId}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: isRefreshing }}
            disabled={isRefreshing}
            onPress={() => loadMenu(true)}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ color: COLORS.surface, fontSize: 16 }}>
              {isRefreshing
                ? "…"
                : currentLanguage === "en"
                  ? "Refresh"
                  : currentLanguage === "zh"
                    ? "刷新"
                    : "更新"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* オフライン警告バナー */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text
            style={[
              styles.offlineBannerText,
              isSmallScreen && styles.offlineBannerTextSmall,
            ]}
          >
            {currentLanguage === "zh"
              ? "📡 离线 - 请检查网络连接"
              : currentLanguage === "en"
                ? "📡 Offline - Please check your connection"
                : "📡 オフライン - ネットワーク接続を確認"}
          </Text>
        </View>
      )}

      {/* 翻訳モード切替（日本語以外のみ表示） */}
      {currentLanguage !== "ja" && (
        <View
          style={[
            styles.translationModeContainer,
            isSmallScreen && styles.translationModeContainerSmall,
          ]}
        >
          <TouchableOpacity
            style={[
              styles.translationModeButton,
              translationMode === "dictionary" &&
                styles.translationModeButtonActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: translationMode === "dictionary" }}
            onPress={() => setTranslationMode("dictionary")}
          >
            <Text
              style={[
                styles.translationModeText,
                translationMode === "dictionary" &&
                  styles.translationModeTextActive,
                isSmallScreen && styles.translationModeTextSmall,
              ]}
            >
              {isVerySmallScreen ? "Dict" : "DeepL + Dict"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.translationModeButton,
              translationMode === "deepl_only" &&
                styles.translationModeButtonActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: translationMode === "deepl_only" }}
            onPress={() => setTranslationMode("deepl_only")}
          >
            <Text
              style={[
                styles.translationModeText,
                translationMode === "deepl_only" &&
                  styles.translationModeTextActive,
                isSmallScreen && styles.translationModeTextSmall,
              ]}
            >
              {isVerySmallScreen ? "DeepL" : "DeepL API Only"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {currentLanguage !== "ja" && (
        <Text
          style={{
            color: COLORS.textSecondary,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          {currentLanguage === "en"
            ? "Switch modes to compare. Labeled original or partial text cannot be compared."
            : "可切换模式进行比较。标注的原文或参考译文不可比较。"}
        </Text>
      )}

      {/* カテゴリタブ */}
      <FlatList
        data={categories}
        renderItem={renderCategoryTab}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.categoryList, { height: categoryTabHeight }]}
        contentContainerStyle={styles.categoryListContent}
      />

      {/* メニューリスト */}
      <FlatList
        data={filteredItems}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.menuList,
          isSmallScreen && styles.menuListSmall,
        ]}
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
              {currentLanguage === "zh"
                ? "此分类暂无菜品"
                : currentLanguage === "en"
                  ? "No items in this category"
                  : "このカテゴリにはメニューがありません"}
            </Text>
          </View>
        }
      />

      {/* カートボタン */}
      <TouchableOpacity
        style={[styles.cartButton, isSmallScreen && styles.cartButtonSmall]}
        onPress={handleCartPress}
      >
        <Text
          style={[
            styles.cartButtonText,
            isSmallScreen && styles.cartButtonTextSmall,
          ]}
        >
          {currentLanguage === "zh"
            ? "🛒 查看购物车"
            : currentLanguage === "en"
              ? "🛒 View Cart"
              : "🛒 カートを見る"}
        </Text>
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
  headerSmall: {
    padding: 12,
    paddingTop: 45,
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
  restaurantNameSmall: {
    fontSize: FONT_SIZES.lg,
  },
  tableInfo: {
    fontSize: FONT_SIZES.md,
    color: COLORS.surface,
    opacity: 0.9,
  },
  offlineBanner: {
    backgroundColor: "#FF6B6B",
    padding: 10,
    alignItems: "center",
  },
  offlineBannerText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.sm,
    fontWeight: "bold",
    textAlign: "center",
  },
  offlineBannerTextSmall: {
    fontSize: FONT_SIZES.xs,
  },
  translationModeContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 5,
    gap: 8,
  },
  translationModeContainerSmall: {
    paddingHorizontal: 10,
    gap: 6,
  },
  translationModeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  translationModeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  translationModeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  translationModeTextSmall: {
    fontSize: FONT_SIZES.xs,
  },
  translationModeTextActive: {
    color: COLORS.surface,
    fontWeight: "bold",
  },
  categoryList: {
    backgroundColor: COLORS.surface,
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
  categoryTabSmall: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 3,
  },
  categoryTabActive: {
    backgroundColor: COLORS.primary,
  },
  categoryIcon: {
    fontSize: 18,
    marginRight: 5,
  },
  categoryIconSmall: {
    fontSize: 16,
    marginRight: 4,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    textAlign: "center",
  },
  categoryTextSmall: {
    fontSize: FONT_SIZES.xs,
  },
  categoryTextActive: {
    color: COLORS.surface,
    fontWeight: "bold",
  },
  menuList: {
    padding: 15,
    paddingBottom: 100,
  },
  menuListSmall: {
    padding: 10,
    paddingBottom: 90,
  },
  menuItem: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImage: {
    // width and height set dynamically
  },
  itemImagePlaceholder: {
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    // fontSize set dynamically
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
  itemNameSmall: {
    fontSize: FONT_SIZES.sm,
  },
  popularBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  popularBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 5,
  },
  popularText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.xs,
    fontWeight: "bold",
  },
  popularTextSmall: {
    fontSize: 10,
  },
  itemDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  itemDescriptionSmall: {
    fontSize: FONT_SIZES.xs,
    marginTop: 3,
  },
  allergenContainer: {
    flexDirection: "row",
    marginTop: 5,
  },
  allergenIcon: {
    fontSize: 14,
    marginRight: 3,
  },
  allergenIconSmall: {
    fontSize: 12,
    marginRight: 2,
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
  cartButtonSmall: {
    bottom: 15,
    left: 15,
    right: 15,
    padding: 12,
  },
  cartButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
  },
  cartButtonTextSmall: {
    fontSize: FONT_SIZES.md,
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

// Keying by store discards the previous catalog before the new store renders.
const MenuScreen = (props) => (
  <RestaurantMenu key={props.route.params.restaurantId} {...props} />
);
export default MenuScreen;
