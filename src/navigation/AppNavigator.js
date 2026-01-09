// アプリナビゲーション設定
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "../constants";
import { LanguageProvider, useLanguage } from "../hooks/useLanguage";
import { useCart } from "../hooks/useCart";
import { CartContext } from "../context/CartContext";

// スクリーンのインポート
import {
  QRScannerScreen,
  LanguageSelectScreen,
  MenuScreen,
  ItemDetailScreen,
  CartScreen,
  OrderCompleteScreen,
} from "../screens";

const Stack = createNativeStackNavigator();

// ナビゲーションスタック
const AppStack = () => {
  const { currentLanguage } = useLanguage();

  // ヘッダータイトルの多言語対応
  const getHeaderTitle = (key) => {
    const titles = {
      QRScanner: { ja: "スキャン", en: "Scan", zh: "扫描" },
      LanguageSelect: { ja: "言語選択", en: "Language", zh: "语言选择" },
      Menu: { ja: "メニュー", en: "Menu", zh: "菜单" },
      ItemDetail: { ja: "商品詳細", en: "Details", zh: "商品详情" },
      Cart: { ja: "カート", en: "Cart", zh: "购物车" },
      OrderComplete: { ja: "注文完了", en: "Complete", zh: "订单完成" },
    };
    return titles[key]?.[currentLanguage] || titles[key]?.ja || key;
  };

  return (
    <Stack.Navigator
      initialRouteName="QRScanner"
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.surface,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="LanguageSelect"
        component={LanguageSelectScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Menu"
        component={MenuScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="ItemDetail"
        component={ItemDetailScreen}
        options={{
          title: getHeaderTitle("ItemDetail"),
          presentation: "modal",
        }}
      />

      <Stack.Screen
        name="Cart"
        component={CartScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="OrderComplete"
        component={OrderCompleteScreen}
        options={{
          headerShown: false,
          gestureEnabled: false, // 戻れないようにする
        }}
      />
    </Stack.Navigator>
  );
};

// メインナビゲーターコンポーネント
const AppNavigator = () => {
  const cart = useCart();

  return (
    <LanguageProvider>
      <CartContext.Provider value={cart}>
        <NavigationContainer>
          <AppStack />
        </NavigationContainer>
      </CartContext.Provider>
    </LanguageProvider>
  );
};

export default AppNavigator;
