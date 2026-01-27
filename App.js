// QRコード対応多言語注文システム - メインエントリーポイント
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import AppNavigator from "./src/navigation/AppNavigator";
import { initializeSentry } from "./src/utils/errorHandler";

export default function App() {
  useEffect(() => {
    initializeSentry();
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StatusBar style="light" />
        <AppNavigator />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
