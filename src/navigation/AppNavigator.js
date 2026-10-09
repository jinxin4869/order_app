// アプリナビゲーション設定
import React, { useCallback, lazy, Suspense } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  NavigationContainer,
  useNavigationContainerRef,
  getPathFromState,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "../constants";
import { LanguageProvider } from "../hooks/useLanguage";
import { useCart } from "../hooks/useCart";
import { CartContext } from "../context/CartContext";
import OrderEntryScreen from "../screens/OrderEntryScreen";
import { syncCartRoute } from "../utils/cartSession";
import { getOrderPath } from "../utils/orderLinks";

// スクリーンのインポート
import LanguageSelectScreen from "../screens/LanguageSelectScreen";
import MenuScreen from "../screens/MenuScreen";
import ItemDetailScreen from "../screens/ItemDetailScreen";
import CartScreen from "../screens/CartScreen";
import OrderCompleteScreen from "../screens/OrderCompleteScreen";

// Loading the camera module eagerly starts its Web barcode worker even when
// the customer enters by a QR URL. Load it only when the scanner is opened.
const Scanner = lazy(() => import("../screens/QRScannerScreen"));
const QRScannerScreen = (props) => (
  <Suspense
    fallback={
      <View>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    }
  >
    <Scanner {...props} />
  </Suspense>
);

const Stack = createNativeStackNavigator();
const linking = {
  prefixes: [],
  config: { screens: { OrderEntry: "order", QRScanner: "" } },
  getPathFromState: (state, options) =>
    getOrderPath(state) || getPathFromState(state, options),
};

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
        name="OrderEntry"
        component={OrderEntryScreen}
        options={{ headerShown: false }}
      />
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
  const navigationRef = useNavigationContainerRef();
  const { setSession, endSession } = cart;
  const syncSession = useCallback(() => {
    syncCartRoute(navigationRef.getCurrentRoute(), { setSession, endSession });
  }, [navigationRef, setSession, endSession]);

  return (
    <LanguageProvider>
      <CartContext.Provider value={cart}>
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          onReady={syncSession}
          onStateChange={syncSession}
        >
          <AppStack />
        </NavigationContainer>
      </CartContext.Provider>
    </LanguageProvider>
  );
};

export default AppNavigator;
