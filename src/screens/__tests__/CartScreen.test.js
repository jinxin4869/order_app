/**
 * CartScreenのテスト
 */

// モック（importの前に設定）
jest.mock("../../hooks/useLanguage");
jest.mock("../../services/api", () => ({
  createOrder: jest.fn(),
}));

import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";
import CartScreen from "../CartScreen";
import { useLanguage } from "../../hooks/useLanguage";
import { CartContext } from "../../context/CartContext";
import * as api from "../../services/api";

jest.spyOn(Alert, "alert");

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

const mockRoute = {
  params: {
    restaurantId: "restaurant_01",
    tableId: "table_01",
    restaurant: { name: "テストレストラン" },
    table: { table_number: "1" },
  },
};

const mockCartItems = [
  {
    id: "item_01",
    name: "枝豆",
    name_ja: "枝豆",
    name_en: "Edamame",
    name_zh: "毛豆",
    price: 500,
    quantity: 2,
    notes: "",
  },
  {
    id: "item_02",
    name: "唐揚げ",
    name_ja: "唐揚げ",
    name_en: "Fried Chicken",
    name_zh: "炸鸡",
    price: 800,
    quantity: 1,
    notes: "わさび抜き",
  },
];

const createMockCartContext = (items = []) => ({
  items,
  updateQuantity: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
  subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  tax: Math.floor(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.1
  ),
  total:
    items.reduce((sum, item) => sum + item.price * item.quantity, 0) +
    Math.floor(
      items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.1
    ),
  isEmpty: items.length === 0,
  itemCount: items.reduce((count, item) => count + item.quantity, 0),
});

describe("CartScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useLanguage.mockReturnValue({
      currentLanguage: "ja",
    });

    api.createOrder.mockResolvedValue({
      orderId: "order_001",
      orderNumber: "001",
    });
  });

  test("カートアイテムを表示する", () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("枝豆")).toBeTruthy();
    expect(getByText("唐揚げ")).toBeTruthy();
    expect(getByText("📝 わさび抜き")).toBeTruthy();
  });

  test("空のカート時にメッセージを表示", () => {
    const mockContext = createMockCartContext([]);

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("カートは空です")).toBeTruthy();
    expect(getByText("メニューから商品を追加してください")).toBeTruthy();
    expect(getByText("メニューに戻る")).toBeTruthy();
  });

  test("空のカートから「メニューに戻る」ボタンで戻る", () => {
    const mockContext = createMockCartContext([]);

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    fireEvent.press(getByText("メニューに戻る"));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test("数量を増やすボタンが機能する", () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getAllByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const plusButtons = getAllByText("+");
    fireEvent.press(plusButtons[0]);

    expect(mockContext.updateQuantity).toHaveBeenCalledWith("item_01", 3, "");
  });

  test("数量を減らすボタンが機能する", () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getAllByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const minusButtons = getAllByText("−");
    fireEvent.press(minusButtons[0]);

    expect(mockContext.updateQuantity).toHaveBeenCalledWith("item_01", 1, "");
  });

  test("削除ボタンをタップすると確認ダイアログを表示", () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getAllByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const deleteButtons = getAllByText("×");
    fireEvent.press(deleteButtons[0]);

    expect(Alert.alert).toHaveBeenCalledWith(
      "削除確認",
      "「枝豆」をカートから削除しますか？",
      expect.any(Array)
    );
  });

  test("言語切り替え時に正しい言語でアイテム名を表示", () => {
    useLanguage.mockReturnValue({
      currentLanguage: "en",
    });

    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("Edamame")).toBeTruthy();
    expect(getByText("Fried Chicken")).toBeTruthy();
  });

  test("注文確定ボタンをタップすると確認ダイアログを表示", () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    fireEvent.press(getByText("注文を確定する"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "注文確認",
      "注文を確定しますか？",
      expect.any(Array)
    );
  });

  test("注文確定が成功すると注文完了画面に遷移", async () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    // 確認ダイアログをモック
    Alert.alert.mockImplementation((title, message, buttons) => {
      const confirmButton = buttons.find((b) => b.text === "注文する");
      if (confirmButton) confirmButton.onPress();
    });

    fireEvent.press(getByText("注文を確定する"));

    await waitFor(() => {
      expect(api.createOrder).toHaveBeenCalledWith({
        restaurantId: "restaurant_01",
        tableId: "table_01",
        customerLanguage: "ja",
        items: expect.any(Array),
        subtotal: expect.any(Number),
        tax: expect.any(Number),
        totalAmount: expect.any(Number),
      });

      expect(mockContext.clearCart).toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith("OrderComplete", {
        orderId: "order_001",
        orderNumber: "001",
        total: expect.any(Number),
        restaurantId: "restaurant_01",
        tableId: "table_01",
        restaurant: mockRoute.params.restaurant,
        table: mockRoute.params.table,
      });
    });
  });

  test("注文確定が失敗するとエラーメッセージを表示", async () => {
    api.createOrder.mockRejectedValue(new Error("ネットワークエラー"));

    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    // 確認ダイアログをモック
    Alert.alert.mockImplementation((title, message, buttons) => {
      if (buttons && Array.isArray(buttons)) {
        const confirmButton = buttons.find((b) => b.text === "注文する");
        if (confirmButton) confirmButton.onPress();
      }
    });

    fireEvent.press(getByText("注文を確定する"));

    await waitFor(() => {
      // 最初は確認ダイアログ、次にエラーダイアログ
      expect(Alert.alert).toHaveBeenCalledWith(
        "エラー",
        "注文の送信に失敗しました。もう一度お試しください。"
      );
    });
  });

  test("戻るボタンをタップすると前の画面に戻る", () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    fireEvent.press(getByText("←"));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test("中国語表示時に正しく翻訳される", () => {
    useLanguage.mockReturnValue({
      currentLanguage: "zh",
    });

    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("毛豆")).toBeTruthy();
    expect(getByText("炸鸡")).toBeTruthy();
    expect(getByText("购物车")).toBeTruthy();
  });
});
