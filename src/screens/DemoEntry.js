// デモ用の入口（開発ビルドのみ）。QRScannerScreen が __DEV__ のときだけ読み込む。
import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { COLORS, FONT_SIZES } from "../constants";
import { useResponsive } from "../hooks/useResponsive";

// デモ用レストランデータ
const DEMO_RESTAURANTS = [
  {
    id: "rest001",
    name: "和食レストラン 桜",
    description: "本格和食・全12カテゴリ",
    icon: "🌸",
    default_language: "ja",
    supported_languages: ["ja", "en", "zh"],
  },
  {
    id: "rest003",
    name: "寿司処 鮨一",
    description: "刺身・寿司専門",
    icon: "🍣",
    default_language: "ja",
    supported_languages: ["ja", "en", "zh"],
  },
  {
    id: "rest004",
    name: "カフェ＆ダイニング HANA",
    description: "カフェ・軽食・デザート",
    icon: "🌺",
    default_language: "ja",
    supported_languages: ["ja", "en", "zh"],
  },
];

const DemoEntry = ({ navigation }) => {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const { isSmallScreen } = useResponsive();

  const handleDemoSelect = (restaurant) => {
    setShowDemoModal(false);
    navigation.navigate("LanguageSelect", {
      restaurantId: restaurant.id,
      tableId: "table001",
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        default_language: restaurant.default_language,
        supported_languages: restaurant.supported_languages,
      },
      table: {
        id: "table001",
        table_number: "1",
      },
    });
  };

  return (
    <>
      {/* デモ用スキップボタン */}
      <TouchableOpacity
        style={[styles.debugButton, isSmallScreen && styles.debugButtonSmall]}
        onPress={() => setShowDemoModal(true)}
      >
        <Text
          style={[
            styles.debugButtonText,
            isSmallScreen && styles.debugButtonTextSmall,
          ]}
        >
          [Demo] Skip
        </Text>
      </TouchableOpacity>

      {/* デモ用レストラン選択モーダル */}
      <Modal
        visible={showDemoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDemoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              isSmallScreen && styles.modalContentSmall,
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                isSmallScreen && styles.modalTitleSmall,
              ]}
            >
              デモ用レストラン選択
            </Text>
            <Text style={styles.modalSubtitle}>
              Select a restaurant for demo
            </Text>
            <FlatList
              data={DEMO_RESTAURANTS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.restaurantOption,
                    isSmallScreen && styles.restaurantOptionSmall,
                  ]}
                  onPress={() => handleDemoSelect(item)}
                >
                  <Text
                    style={[
                      styles.restaurantIcon,
                      isSmallScreen && styles.restaurantIconSmall,
                    ]}
                  >
                    {item.icon}
                  </Text>
                  <View style={styles.restaurantInfo}>
                    <Text
                      style={[
                        styles.restaurantName,
                        isSmallScreen && styles.restaurantNameSmall,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.restaurantDescription,
                        isSmallScreen && styles.restaurantDescriptionSmall,
                      ]}
                    >
                      {item.description}
                    </Text>
                  </View>
                  <Text style={styles.restaurantArrow}>→</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDemoModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>閉じる / Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  debugButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(76, 175, 80, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 10,
  },
  debugButtonSmall: {
    top: 45,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  debugButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.sm,
    fontWeight: "bold",
  },
  debugButtonTextSmall: {
    fontSize: FONT_SIZES.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "70%",
  },
  modalContentSmall: {
    padding: 16,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "bold",
    color: COLORS.text,
    textAlign: "center",
  },
  modalTitleSmall: {
    fontSize: FONT_SIZES.lg,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  restaurantOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  restaurantOptionSmall: {
    padding: 12,
    marginBottom: 10,
  },
  restaurantIcon: {
    fontSize: 36,
    marginRight: 14,
  },
  restaurantIconSmall: {
    fontSize: 28,
    marginRight: 10,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    color: COLORS.text,
  },
  restaurantNameSmall: {
    fontSize: FONT_SIZES.sm,
  },
  restaurantDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  restaurantDescriptionSmall: {
    fontSize: FONT_SIZES.xs,
  },
  restaurantArrow: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  modalCloseButton: {
    marginTop: 8,
    padding: 14,
    borderRadius: 25,
    backgroundColor: COLORS.background,
    alignItems: "center",
  },
  modalCloseButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
});

export default DemoEntry;
