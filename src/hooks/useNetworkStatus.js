// ネットワーク接続状態を監視するカスタムフック
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";

// Chromium can fire online/offline without a Network Information change event.
// Install one listener pair for the shared NetInfo store, even across screens.
let webSubscribers = 0;
const refreshWebStatus = () => {
  NetInfo.refresh().catch(() => {});
};
const subscribeToWebEvents = () => {
  if (
    Platform.OS !== "web" ||
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function"
  )
    return;
  if (webSubscribers++ === 0) {
    window.addEventListener("online", refreshWebStatus);
    window.addEventListener("offline", refreshWebStatus);
    refreshWebStatus();
  }
  return () => {
    if (--webSubscribers === 0) {
      window.removeEventListener("online", refreshWebStatus);
      window.removeEventListener("offline", refreshWebStatus);
    }
  };
};

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    // ネットワーク状態の変化を監視
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
      setIsInternetReachable(state.isInternetReachable ?? true);
    });

    const unsubscribeWeb = subscribeToWebEvents();
    return () => {
      unsubscribeWeb?.();
      unsubscribe();
    };
  }, []);

  return {
    isConnected,
    isInternetReachable,
    isOnline: isConnected && isInternetReachable,
  };
};
