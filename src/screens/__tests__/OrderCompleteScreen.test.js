/**
 * OrderCompleteScreenのテスト
 */

jest.mock("../../hooks/useLanguage");

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import OrderCompleteScreen from "../OrderCompleteScreen";
import { useLanguage } from "../../hooks/useLanguage";

const mockNavigation = {
  navigate: jest.fn(),
  reset: jest.fn(),
};

const mockRoute = {
  params: {
    orderId: "order_123456",
    orderNumber: "A123",
    total: 1980,
    restaurantId: "restaurant_01",
    tableId: "table_01",
    restaurant: { name: "テストレストラン" },
    table: { table_number: "1" },
  },
};

describe("OrderCompleteScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    useLanguage.mockReturnValue({
      currentLanguage: "ja",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("注文完了画面が正しくレンダリングされる", () => {
    const { getByText } = render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    // アニメーションを進める
    jest.advanceTimersByTime(1000);

    expect(getByText("ご注文ありがとうございます！")).toBeTruthy();
    expect(getByText("A123")).toBeTruthy();
    expect(getByText("テストレストラン")).toBeTruthy();
  });

  it("注文番号が表示される", () => {
    const { getByText } = render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    jest.advanceTimersByTime(1000);

    expect(getByText("注文番号")).toBeTruthy();
    expect(getByText("A123")).toBeTruthy();
  });

  it("orderNumberがない場合はorderIdの末尾6文字が表示される", () => {
    const routeWithoutOrderNumber = {
      params: {
        ...mockRoute.params,
        orderNumber: null,
      },
    };

    const { getByText } = render(
      <OrderCompleteScreen
        navigation={mockNavigation}
        route={routeWithoutOrderNumber}
      />
    );

    jest.advanceTimersByTime(1000);

    // orderId "order_123456" の末尾6文字 "123456"
    expect(getByText("123456")).toBeTruthy();
  });

  it("追加注文ボタンを押すとメニュー画面に遷移する", () => {
    const { getByText } = render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    jest.advanceTimersByTime(1000);

    const addMoreButton = getByText("追加注文する");
    fireEvent.press(addMoreButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Menu", {
      restaurantId: "restaurant_01",
      tableId: "table_01",
      restaurant: { name: "テストレストラン" },
      table: { table_number: "1" },
    });
  });

  it("終了ボタンを押すとQRスキャン画面にリセットする", () => {
    const { getByText } = render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    jest.advanceTimersByTime(1000);

    const finishButton = getByText("終了する");
    fireEvent.press(finishButton);

    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "QRScanner" }],
    });
  });

  describe("言語切り替え", () => {
    it("英語表示が正しく動作する", () => {
      useLanguage.mockReturnValue({
        currentLanguage: "en",
      });

      const { getByText } = render(
        <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
      );

      jest.advanceTimersByTime(1000);

      expect(getByText("Thank you for your order!")).toBeTruthy();
      expect(getByText("Order Number")).toBeTruthy();
      expect(getByText("Add More Items")).toBeTruthy();
      expect(getByText("Finish")).toBeTruthy();
    });

    it("中国語表示が正しく動作する", () => {
      useLanguage.mockReturnValue({
        currentLanguage: "zh",
      });

      const { getByText } = render(
        <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
      );

      jest.advanceTimersByTime(1000);

      expect(getByText("感谢您的订购！")).toBeTruthy();
      expect(getByText("订单号")).toBeTruthy();
      expect(getByText("继续点餐")).toBeTruthy();
      expect(getByText("结束")).toBeTruthy();
    });
  });

  it("テーブル情報が表示される", () => {
    const { getByText } = render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    jest.advanceTimersByTime(1000);

    expect(getByText("テーブル")).toBeTruthy();
    expect(getByText("1")).toBeTruthy();
  });

  it("restaurant/tableがない場合はハイフンが表示される", () => {
    const routeWithoutData = {
      params: {
        orderId: "order_123456",
        orderNumber: "A123",
        total: 1980,
        restaurantId: "restaurant_01",
        tableId: "table_01",
        restaurant: null,
        table: null,
      },
    };

    const { getAllByText } = render(
      <OrderCompleteScreen
        navigation={mockNavigation}
        route={routeWithoutData}
      />
    );

    jest.advanceTimersByTime(1000);

    const dashes = getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
