/**
 * useNetworkStatusフックのテスト
 */

import { renderHook, waitFor } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";
import { useNetworkStatus } from "../useNetworkStatus";

// NetInfoをモック
jest.mock("@react-native-community/netinfo");

describe("useNetworkStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("初期状態はオンライン", () => {
    // fetchをモック
    NetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    // addEventListenerをモック
    NetInfo.addEventListener.mockReturnValue(() => {});

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isInternetReachable).toBe(true);
    expect(result.current.isOnline).toBe(true);
  });

  test("ネットワーク状態の変化を検知する", async () => {
    let networkListener;

    // addEventListenerをモックして、リスナーを保存
    NetInfo.addEventListener.mockImplementation((listener) => {
      networkListener = listener;
      return () => {};
    });

    NetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    const { result } = renderHook(() => useNetworkStatus());

    // 初期状態を確認
    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
    });

    // ネットワーク状態を変更
    act(() => {
      networkListener({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    // オフライン状態を確認
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInternetReachable).toBe(false);
    expect(result.current.isOnline).toBe(false);
  });

  test("接続はあるがインターネットに到達不可の場合はオフライン", async () => {
    let networkListener;

    NetInfo.addEventListener.mockImplementation((listener) => {
      networkListener = listener;
      return () => {};
    });

    NetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      networkListener({
        isConnected: true,
        isInternetReachable: false,
      });
    });

    expect(result.current.isOnline).toBe(false);
  });

  test("アンマウント時にリスナーを解除する", () => {
    const unsubscribe = jest.fn();
    NetInfo.addEventListener.mockReturnValue(unsubscribe);
    NetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
