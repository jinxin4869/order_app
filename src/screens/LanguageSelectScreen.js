// 言語選択画面
import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES } from "../constants";
import { useLanguage } from "../hooks/useLanguage";

const LanguageSelectScreen = ({ navigation, route }) => {
  const { restaurantId, tableId, restaurant, table } = route.params;
  const { changeLanguage, availableLanguages } = useLanguage();

  const handleLanguageSelect = (langCode) => {
    changeLanguage(langCode);
    navigation.navigate("Menu", {
      restaurantId,
      tableId,
      restaurant,
      table,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.restaurantName}>
          {restaurant?.name || "レストラン"}
        </Text>
        <Text style={styles.tableInfo}>
          テーブル {table?.table_number || tableId}
        </Text>
      </View>

      {/* 言語選択 */}
      <View style={styles.content}>
        <Text style={styles.title}>言語を選択してください</Text>
        <Text style={styles.subtitle}>Select your language</Text>
        <Text style={styles.subtitle}>请选择语言</Text>

        <View style={styles.languageGrid}>
          {availableLanguages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={styles.languageButton}
              onPress={() => handleLanguageSelect(lang.code)}
            >
              <Text style={styles.languageFlag}>{lang.flag}</Text>
              <Text style={styles.languageName}>{lang.nativeName}</Text>
              <Text style={styles.languageEnglish}>{lang.name}</Text>
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
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 40,
    gap: 15,
  },
  languageButton: {
    width: 150,
    height: 150,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    margin: 10,
  },
  languageFlag: {
    fontSize: 50,
    marginBottom: 10,
  },
  languageName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "bold",
    color: COLORS.text,
  },
  languageEnglish: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 5,
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
