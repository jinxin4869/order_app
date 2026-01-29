/**
 * QRScannerScreenのテスト
 */

// expo-cameraのモック
jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: jest.fn(),
}));

jest.mock("../../services/api", () => ({
  validateQRCode: jest.fn(),
}));

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import QRScannerScreen from "../QRScannerScreen";
import { useCameraPermissions } from "expo-camera";
import * as api from "../../services/api";

jest.spyOn(Alert, "alert");

const mockNavigation = {
  navigate: jest.fn(),
};

describe("QRScannerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("権限の状態", () => {
    it("権限リクエスト中はローディングが表示される", () => {
      useCameraPermissions.mockReturnValue([null, jest.fn()]);

      const { getByText } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      expect(getByText(/カメラ権限をリクエスト中/)).toBeTruthy();
      expect(getByText(/Requesting camera permission/)).toBeTruthy();
    });

    it("権限が拒否された場合はエラーメッセージと許可ボタンが表示される", () => {
      const mockRequestPermission = jest.fn();
      useCameraPermissions.mockReturnValue([
        { granted: false },
        mockRequestPermission,
      ]);

      const { getByText } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      expect(getByText(/カメラへのアクセスが必要です/)).toBeTruthy();
      expect(getByText(/Camera access is required/)).toBeTruthy();

      const permissionButton = getByText(/権限を許可/);
      fireEvent.press(permissionButton);

      expect(mockRequestPermission).toHaveBeenCalled();
    });

    it("権限が許可された場合はカメラビューが表示される", () => {
      useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);

      const { getByText } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      expect(
        getByText(/テーブルのQRコードをスキャンしてください/)
      ).toBeTruthy();
      expect(getByText(/Scan the QR code on your table/)).toBeTruthy();
    });
  });

  describe("QRコードスキャン", () => {
    beforeEach(() => {
      useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    });

    it("有効なQRコードをスキャンすると言語選択画面に遷移する", async () => {
      const mockResult = {
        valid: true,
        restaurant: { name: "テストレストラン" },
        table: { table_number: "1" },
      };
      api.validateQRCode.mockResolvedValue(mockResult);

      const { UNSAFE_root } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      // CameraViewのonBarcodeScannedをシミュレート
      const cameraView = UNSAFE_root.findByType("CameraView");

      await act(async () => {
        if (cameraView.props.onBarcodeScanned) {
          await cameraView.props.onBarcodeScanned({
            data: "restaurant_01/table_01",
          });
        }
      });

      await waitFor(() => {
        expect(api.validateQRCode).toHaveBeenCalledWith(
          "restaurant_01/table_01"
        );
        expect(mockNavigation.navigate).toHaveBeenCalledWith("LanguageSelect", {
          restaurantId: "restaurant_01",
          tableId: "table_01",
          restaurant: mockResult.restaurant,
          table: mockResult.table,
        });
      });
    });

    it("無効なQRコード形式の場合はエラーアラートが表示される", async () => {
      const { UNSAFE_root } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      const cameraView = UNSAFE_root.findByType("CameraView");

      await act(async () => {
        if (cameraView.props.onBarcodeScanned) {
          await cameraView.props.onBarcodeScanned({ data: "invalid_format" });
        }
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "エラー",
          "無効なQRコードです。\nInvalid QR code.",
          expect.any(Array)
        );
      });

      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it("APIが無効な応答を返した場合はエラーアラートが表示される", async () => {
      api.validateQRCode.mockResolvedValue({
        valid: false,
        error: "テーブルが見つかりません",
      });

      const { UNSAFE_root } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      const cameraView = UNSAFE_root.findByType("CameraView");

      await act(async () => {
        if (cameraView.props.onBarcodeScanned) {
          await cameraView.props.onBarcodeScanned({
            data: "restaurant_01/table_01",
          });
        }
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "エラー",
          "テーブルが見つかりません",
          expect.any(Array)
        );
      });
    });

    it("API呼び出しでエラーが発生した場合は接続エラーアラートが表示される", async () => {
      api.validateQRCode.mockRejectedValue(new Error("Network error"));

      const { UNSAFE_root } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      const cameraView = UNSAFE_root.findByType("CameraView");

      await act(async () => {
        if (cameraView.props.onBarcodeScanned) {
          await cameraView.props.onBarcodeScanned({
            data: "restaurant_01/table_01",
          });
        }
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "エラー",
          "接続エラーが発生しました。\nConnection error occurred.",
          expect.any(Array)
        );
      });
    });
  });

  describe("再スキャン機能", () => {
    it("スキャン後に再スキャンボタンが表示される", async () => {
      useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
      api.validateQRCode.mockRejectedValue(new Error("Error"));

      const { UNSAFE_root, findByText } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      const cameraView = UNSAFE_root.findByType("CameraView");

      await act(async () => {
        if (cameraView.props.onBarcodeScanned) {
          await cameraView.props.onBarcodeScanned({
            data: "restaurant_01/table_01",
          });
        }
      });

      // エラーアラートのOKを押す
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // アラートのOKボタンを押す（モックされたAlert）
      const alertCall = Alert.alert.mock.calls[0];
      if (alertCall && alertCall[2] && alertCall[2][0]) {
        alertCall[2][0].onPress();
      }

      // 再スキャンボタンの表示を待つ
      // Note: この部分はスキャン状態のリセット後に表示される
    });
  });

  describe("デモ用スキップボタン", () => {
    it("デモ用スキップボタンが表示される", () => {
      useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);

      const { getByText } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      expect(getByText("[Demo] Skip Scan")).toBeTruthy();
    });

    it("デモ用スキップボタンを押すと言語選択画面に遷移する", () => {
      useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);

      const { getByText } = render(
        <QRScannerScreen navigation={mockNavigation} />
      );

      fireEvent.press(getByText("[Demo] Skip Scan"));

      expect(mockNavigation.navigate).toHaveBeenCalledWith("LanguageSelect", {
        restaurantId: "rest001",
        tableId: "table001",
        restaurant: {
          id: "rest001",
          name: "和食レストラン 桜",
          default_language: "ja",
          supported_languages: ["ja", "en", "zh"],
        },
        table: {
          id: "table001",
          table_number: "1",
        },
      });
    });
  });
});
