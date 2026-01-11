/**
 * ItemDetailScreenのテスト
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ItemDetailScreen from "../ItemDetailScreen";
import { useLanguage } from "../../hooks/useLanguage";
import { CartContext } from "../../context/CartContext";

// モック
jest.mock("../../hooks/useLanguage");

const mockNavigation = {
  goBack: jest.fn(),
};

const mockItem = {
  id: "item_01",
  name_ja: "枝豆",
  name_en: "Edamame",
  name_zh: "毛豆",
  description_ja: "塩茹でした枝豆",
  description_en: "Salted boiled soybeans",
  description_zh: "盐水煮毛豆",
  price: 500,
  image_url: "https://example.com/edamame.jpg",
  is_popular: true,
  allergens: ["soy"],
  cooking_time: 5,
};

const mockRoute = {
  params: {
    item: mockItem,
  },
};

const createMockCartContext = () => ({
  addItem: jest.fn(),
  items: [],
  updateQuantity: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
  subtotal: 0,
  tax: 0,
  total: 0,
  isEmpty: true,
  itemCount: 0,
});

describe("ItemDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useLanguage.mockReturnValue({
      currentLanguage: "ja",
      getItemName: (item) => item.name_ja,
      getItemDescription: (item) => item.description_ja,
    });
  });

  test("商品情報を正しく表示する", () => {
    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("枝豆")).toBeTruthy();
    expect(getByText("塩茹でした枝豆")).toBeTruthy();
    expect(getByText("人気")).toBeTruthy();
  });

  test("調理時間を表示する", () => {
    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("調理時間: 約5分")).toBeTruthy();
  });

  test("数量を増やすボタンが機能する", () => {
    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const plusButton = getByText("+");
    fireEvent.press(plusButton);

    expect(getByText("2")).toBeTruthy();
  });

  test("数量を減らすボタンが機能する", () => {
    const mockContext = createMockCartContext();

    const { getByText, getAllByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const plusButton = getByText("+");
    fireEvent.press(plusButton);
    fireEvent.press(plusButton);

    expect(getByText("3")).toBeTruthy();

    const minusButton = getByText("−");
    fireEvent.press(minusButton);

    expect(getAllByText("2")).toBeTruthy();
  });

  test("数量が1より小さくならない", () => {
    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const minusButton = getByText("−");
    fireEvent.press(minusButton);

    expect(getByText("1")).toBeTruthy();
  });

  test("数量が99より大きくならない", () => {
    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const plusButton = getByText("+");

    // 99回押す
    for (let i = 0; i < 100; i++) {
      fireEvent.press(plusButton);
    }

    expect(getByText("99")).toBeTruthy();
  });

  test("カートに追加すると前の画面に戻る", () => {
    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const addButton = getByText("カートに追加");
    fireEvent.press(addButton);

    expect(mockContext.addItem).toHaveBeenCalledWith(
      {
        id: "item_01",
        name: "枝豆",
        name_ja: "枝豆",
        name_en: "Edamame",
        name_zh: "毛豆",
        price: 500,
        image_url: "https://example.com/edamame.jpg",
      },
      1,
      ""
    );

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test("特別リクエストを入力できる", () => {
    const mockContext = createMockCartContext();

    const { getByPlaceholderText, getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const notesInput = getByPlaceholderText("例: わさび抜き、少なめなど");
    fireEvent.changeText(notesInput, "わさび抜き");

    const addButton = getByText("カートに追加");
    fireEvent.press(addButton);

    expect(mockContext.addItem).toHaveBeenCalledWith(
      expect.any(Object),
      1,
      "わさび抜き"
    );
  });

  test("戻るボタンをタップすると前の画面に戻る", () => {
    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const backButton = getByText("←");
    fireEvent.press(backButton);

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test("英語表示時に正しく翻訳される", () => {
    useLanguage.mockReturnValue({
      currentLanguage: "en",
      getItemName: (item) => item.name_en,
      getItemDescription: (item) => item.description_en,
    });

    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("Edamame")).toBeTruthy();
    expect(getByText("Salted boiled soybeans")).toBeTruthy();
    expect(getByText("Add to Cart")).toBeTruthy();
  });

  test("中国語表示時に正しく翻訳される", () => {
    useLanguage.mockReturnValue({
      currentLanguage: "zh",
      getItemName: (item) => item.name_zh,
      getItemDescription: (item) => item.description_zh,
    });

    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("毛豆")).toBeTruthy();
    expect(getByText("盐水煮毛豆")).toBeTruthy();
    expect(getByText("加入购物车")).toBeTruthy();
  });

  test("画像がない場合プレースホルダーを表示", () => {
    const itemWithoutImage = {
      ...mockItem,
      image_url: null,
    };

    const mockContext = createMockCartContext();

    const { getByText } = render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen
          navigation={mockNavigation}
          route={{ params: { item: itemWithoutImage } }}
        />
      </CartContext.Provider>
    );

    expect(getByText("🍽️")).toBeTruthy();
  });
});
