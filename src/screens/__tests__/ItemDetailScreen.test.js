/**
 * ItemDetailScreenのテスト
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ItemDetailScreen from "../ItemDetailScreen";
import { getMenuAvailability } from "../../services/api";
jest.mock("../../services/api", () => ({
  getMenuAvailability: jest.fn(async () => ({ ordering: "open", soldOut: [] })),
}));
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
    restaurantId: "rest-test",
    tableId: "table-test",
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

  test("商品情報を正しく表示する", async () => {
    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("枝豆")).toBeTruthy();
    expect(getByText("塩茹でした枝豆")).toBeTruthy();
    expect(getByText("人気")).toBeTruthy();
  });

  test("調理時間を表示する", async () => {
    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("調理時間: 約5分")).toBeTruthy();
  });

  test("数量を増やすボタンが機能する", async () => {
    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const plusButton = getByText("+");
    await fireEvent.press(plusButton);

    expect(getByText("2")).toBeTruthy();
  });

  test("数量を減らすボタンが機能する", async () => {
    const mockContext = createMockCartContext();

    const { getByText, getAllByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const plusButton = getByText("+");
    await fireEvent.press(plusButton);
    await fireEvent.press(plusButton);

    expect(getByText("3")).toBeTruthy();

    const minusButton = getByText("−");
    await fireEvent.press(minusButton);

    expect(getAllByText("2")).toBeTruthy();
  });

  test("数量が1より小さくならない", async () => {
    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const minusButton = getByText("−");
    await fireEvent.press(minusButton);

    expect(getByText("1")).toBeTruthy();
  });

  test("数量が99より大きくならない", async () => {
    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const plusButton = getByText("+");

    // 99回押す
    for (let i = 0; i < 100; i++) {
      await fireEvent.press(plusButton);
    }

    expect(getByText("99")).toBeTruthy();
  });

  test("カートに追加すると前の画面に戻る", async () => {
    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const addButton = getByText("カートに追加");
    await fireEvent.press(addButton);

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
      "",
      { restaurantId: "rest-test", tableId: "table-test" }
    );

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test("特別リクエストを入力できる", async () => {
    const mockContext = createMockCartContext();

    const { getByPlaceholderText, getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const notesInput = getByPlaceholderText("例: わさび抜き、少なめなど");
    await fireEvent.changeText(notesInput, "わさび抜き");

    const addButton = getByText("カートに追加");
    await fireEvent.press(addButton);

    expect(mockContext.addItem).toHaveBeenCalledWith(
      expect.any(Object),
      1,
      "わさび抜き",
      { restaurantId: "rest-test", tableId: "table-test" }
    );
  });

  test("戻るボタンをタップすると前の画面に戻る", async () => {
    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const backButton = getByText("←");
    await fireEvent.press(backButton);

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test("英語表示時に正しく翻訳される", async () => {
    useLanguage.mockReturnValue({
      currentLanguage: "en",
      getItemName: (item) => item.name_en,
      getItemDescription: (item) => item.description_en,
    });

    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("Edamame")).toBeTruthy();
    expect(getByText("Salted boiled soybeans")).toBeTruthy();
    expect(getByText("Add to Cart")).toBeTruthy();
  });

  test("中国語表示時に正しく翻訳される", async () => {
    useLanguage.mockReturnValue({
      currentLanguage: "zh",
      getItemName: (item) => item.name_zh,
      getItemDescription: (item) => item.description_zh,
    });

    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("毛豆")).toBeTruthy();
    expect(getByText("盐水煮毛豆")).toBeTruthy();
    expect(getByText("加入购物车")).toBeTruthy();
  });

  test("画像がない場合プレースホルダーを表示", async () => {
    const itemWithoutImage = {
      ...mockItem,
      image_url: null,
    };

    const mockContext = createMockCartContext();

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen
          navigation={mockNavigation}
          route={{ params: { item: itemWithoutImage } }}
        />
      </CartContext.Provider>
    );

    expect(getByText("🍽️")).toBeTruthy();
  });
  test("a sold-out item can be viewed but not added", async () => {
    getMenuAvailability.mockResolvedValueOnce({
      ordering: "open",
      soldOut: ["item_01"],
    });
    const mockContext = createMockCartContext();
    const screen = await render(
      <CartContext.Provider value={mockContext}>
        <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    const button = await screen.findByRole("button", { name: "売り切れ" });
    expect(screen.getByText("塩茹でした枝豆")).toBeTruthy();
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button);
    expect(mockContext.addItem).not.toHaveBeenCalled();
  });
});

test("detail quantity considers the existing cart line before adding", async () => {
  jest.clearAllMocks();
  useLanguage.mockReturnValue({
    currentLanguage: "ja",
    getItemName: (item) => item.name_ja,
    getItemDescription: () => "",
  });
  const context = {
    ...createMockCartContext(),
    items: [{ ...mockItem, quantity: 98, notes: "" }],
  };
  const view = await render(
    <CartContext.Provider value={context}>
      <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
    </CartContext.Provider>
  );
  await fireEvent.press(view.getByText("+"));
  expect(view.getByText("1")).toBeTruthy();
  expect(
    view.getByText("同じ商品・備考は99個まで（カート内98個）")
  ).toBeTruthy();
  await fireEvent.press(view.getByText("カートに追加"));
  expect(context.addItem).toHaveBeenCalledWith(expect.any(Object), 1, "", {
    restaurantId: "rest-test",
    tableId: "table-test",
  });
});
test("detail additions are disabled when the existing cart line is already 99", async () => {
  jest.clearAllMocks();
  useLanguage.mockReturnValue({
    currentLanguage: "ja",
    getItemName: (item) => item.name_ja,
    getItemDescription: () => "",
  });
  const context = {
    ...createMockCartContext(),
    items: [{ ...mockItem, quantity: 99, notes: "" }],
  };
  const view = await render(
    <CartContext.Provider value={context}>
      <ItemDetailScreen navigation={mockNavigation} route={mockRoute} />
    </CartContext.Provider>
  );
  await fireEvent.press(view.getByText("カートに追加"));
  expect(context.addItem).not.toHaveBeenCalled();
});
