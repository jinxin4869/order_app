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
  popTo: jest.fn(),
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

  it("注文完了画面が正しくレンダリングされる", async () => {
    const { getByText } = await render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    // アニメーションを進める
    jest.advanceTimersByTime(1000);

    expect(getByText("ご注文ありがとうございます！")).toBeTruthy();
    expect(getByText("A123")).toBeTruthy();
    expect(getByText("テストレストラン")).toBeTruthy();
  });

  it("注文番号が表示される", async () => {
    const { getByText } = await render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    jest.advanceTimersByTime(1000);

    expect(getByText("注文番号")).toBeTruthy();
    expect(getByText("A123")).toBeTruthy();
  });

  it("orderNumberがない場合はorderIdの末尾6文字が表示される", async () => {
    const routeWithoutOrderNumber = {
      params: {
        ...mockRoute.params,
        orderNumber: null,
      },
    };

    const { getByText } = await render(
      <OrderCompleteScreen
        navigation={mockNavigation}
        route={routeWithoutOrderNumber}
      />
    );

    jest.advanceTimersByTime(1000);

    // orderId "order_123456" の末尾6文字 "123456"
    expect(getByText("123456")).toBeTruthy();
  });

  it("追加注文ボタンを押すと既存のメニュー画面まで戻る", async () => {
    const { getByText } = await render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    jest.advanceTimersByTime(1000);

    const addMoreButton = getByText("追加注文する");
    await fireEvent.press(addMoreButton);

    expect(mockNavigation.popTo).toHaveBeenCalledWith("Menu", {
      restaurantId: "restaurant_01",
      tableId: "table_01",
      restaurant: { name: "テストレストラン" },
      table: { table_number: "1" },
    });
  });

  it("終了ボタンを押すとQRスキャン画面にリセットする", async () => {
    const { getByText } = await render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    jest.advanceTimersByTime(1000);

    const finishButton = getByText("終了する");
    await fireEvent.press(finishButton);

    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "QRScanner" }],
    });
  });

  describe("言語切り替え", () => {
    it("英語表示が正しく動作する", async () => {
      useLanguage.mockReturnValue({
        currentLanguage: "en",
      });

      const { getByText } = await render(
        <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
      );

      jest.advanceTimersByTime(1000);

      expect(getByText("Thank you for your order!")).toBeTruthy();
      expect(getByText("Order Number")).toBeTruthy();
      expect(getByText("Add More Items")).toBeTruthy();
      expect(getByText("Finish")).toBeTruthy();
    });

    it("中国語表示が正しく動作する", async () => {
      useLanguage.mockReturnValue({
        currentLanguage: "zh",
      });

      const { getByText } = await render(
        <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
      );

      jest.advanceTimersByTime(1000);

      expect(getByText("感谢您的订购！")).toBeTruthy();
      expect(getByText("订单号")).toBeTruthy();
      expect(getByText("继续点餐")).toBeTruthy();
      expect(getByText("结束")).toBeTruthy();
    });
  });

  it("テーブル情報が表示される", async () => {
    const { getByText } = await render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );

    jest.advanceTimersByTime(1000);

    expect(getByText("テーブル")).toBeTruthy();
    expect(getByText("1")).toBeTruthy();
  });

  it("restaurant/tableがない場合はハイフンが表示される", async () => {
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

    const { getAllByText } = await render(
      <OrderCompleteScreen
        navigation={mockNavigation}
        route={routeWithoutData}
      />
    );

    jest.advanceTimersByTime(1000);

    const dashes = getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  test("注文履歴を見るで、この来店の注文履歴を開く", async () => {
    const { getByText } = await render(
      <OrderCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    await fireEvent.press(getByText("注文履歴を見る"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("OrderHistory", {
      restaurantId: "restaurant_01",
      tableId: "table_01",
      restaurant: mockRoute.params.restaurant,
      table: mockRoute.params.table,
    });
  });
});
