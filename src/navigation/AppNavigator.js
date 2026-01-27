// アプリナビゲーション設定
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "../constants";
import { LanguageProvider } from "../hooks/useLanguage";
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
          headerShown: false,
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
