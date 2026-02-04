// 言語選択画面
import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES } from "../constants";
import { useLanguage } from "../hooks/useLanguage";
import { useResponsive } from "../hooks/useResponsive";

const LanguageSelectScreen = ({ navigation, route }) => {
  const { restaurantId, tableId, restaurant, table } = route.params;
  const { changeLanguage, availableLanguages } = useLanguage();
  const { width, isSmallScreen, isVerySmallScreen, scaleSize } =
    useResponsive();

  const handleLanguageSelect = (langCode) => {
    changeLanguage(langCode);
    navigation.navigate("Menu", {
      restaurantId,
      tableId,
      restaurant,
      table,
    });
  };

  // 画面幅に応じてボタンサイズを計算
  // 2列レイアウト: (画面幅 - padding - gap) / 2
  const buttonSize = Math.min(
    Math.floor((width - 40 - 15) / 2), // 2列に収まるサイズ
    150 // 最大150px
  );

  // 非常に小さい画面では1列レイアウトに
  const useOneColumn = isVerySmallScreen;
  const oneColumnButtonWidth = width - 60;

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text
          style={[
            styles.restaurantName,
            isSmallScreen && styles.restaurantNameSmall,
          ]}
          numberOfLines={2}
        >
          {restaurant?.name || "レストラン"}
        </Text>
        <Text style={styles.tableInfo}>
          Table {table?.table_number || tableId}
        </Text>
      </View>

      {/* 言語選択 */}
      <View style={styles.content}>
        <Text
          style={[styles.title, isSmallScreen && styles.titleSmall]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          言語を選択してください
        </Text>
        <Text style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}>
          Select your language
        </Text>
        <Text style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}>
          请选择语言
        </Text>

        <View
          style={[
            styles.languageGrid,
            useOneColumn && styles.languageGridColumn,
          ]}
        >
          {availableLanguages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton,
                useOneColumn
                  ? {
                      width: oneColumnButtonWidth,
                      height: scaleSize(100, 80, 120),
                      flexDirection: "row",
                      justifyContent: "flex-start",
                      paddingHorizontal: 20,
                    }
                  : {
                      width: buttonSize,
                      height: buttonSize,
                    },
              ]}
              onPress={() => handleLanguageSelect(lang.code)}
            >
              <Text
                style={[
                  styles.languageFlag,
                  useOneColumn && styles.languageFlagRow,
                  { fontSize: scaleSize(50, 36, 50) },
                ]}
              >
                {lang.flag}
              </Text>
              <View style={useOneColumn && styles.languageTextContainer}>
                <Text
                  style={[
                    styles.languageName,
                    { fontSize: scaleSize(FONT_SIZES.xl, 16, 20) },
                  ]}
                >
                  {lang.nativeName}
                </Text>
                <Text
                  style={[
                    styles.languageEnglish,
                    { fontSize: scaleSize(FONT_SIZES.sm, 12, 14) },
                  ]}
                >
                  {lang.name}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* フッター */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by QR Order System</Text>
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
    padding: 20,
    alignItems: "center",
  },
  restaurantName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    color: COLORS.surface,
    textAlign: "center",
  },
  restaurantNameSmall: {
    fontSize: FONT_SIZES.xl,
  },
  tableInfo: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.surface,
    marginTop: 5,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 10,
    textAlign: "center",
  },
  titleSmall: {
    fontSize: FONT_SIZES.lg,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  subtitleSmall: {
    fontSize: FONT_SIZES.md,
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 30,
    gap: 15,
  },
  languageGridColumn: {
    flexDirection: "column",
    alignItems: "center",
    marginTop: 20,
    gap: 12,
  },
  languageButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  languageFlag: {
    marginBottom: 10,
  },
  languageFlagRow: {
    marginBottom: 0,
    marginRight: 15,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageName: {
    fontWeight: "bold",
    color: COLORS.text,
  },
  languageEnglish: {
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  footer: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
});

export default LanguageSelectScreen;
