// QRコード対応多言語注文システム - メインエントリーポイント
import React from "react";
import { StatusBar } from "expo-status-bar";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <AppNavigator />
    </ErrorBoundary>
  );
}
