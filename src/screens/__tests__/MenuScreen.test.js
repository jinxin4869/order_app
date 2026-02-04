/**
 * MenuScreenのテスト
 */

// モック（importの前に設定）
jest.mock("../../hooks/useLanguage");
jest.mock("../../hooks/useNetworkStatus");
jest.mock("../../services/api", () => ({
  getMenuWithTranslation: jest.fn(),
}));

import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import MenuScreen from "../MenuScreen";
import { useLanguage } from "../../hooks/useLanguage";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import * as api from "../../services/api";

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

const mockCategories = [
  { id: "cat_01", name_ja: "前菜", name_en: "Appetizer", icon: "🥗" },
  { id: "cat_02", name_ja: "メイン", name_en: "Main", icon: "🍖" },
];

const mockMenuItems = [
  {
    id: "item_01",
    category_id: "cat_01",
    name_ja: "枝豆",
    name_en: "Edamame",
    description_ja: "塩茹でした枝豆",
    price: 500,
    is_available: true,
    is_popular: true,
  },
  {
    id: "item_02",
    category_id: "cat_02",
    name_ja: "唐揚げ",
    name_en: "Fried Chicken",
    description_ja: "ジューシーな唐揚げ",
    price: 800,
    is_available: true,
  },
];

describe("MenuScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // デフォルトのモック設定
    useLanguage.mockReturnValue({
      currentLanguage: "ja",
      getItemName: (item) => item.name_ja,
      getItemDescription: (item) => item.description_ja,
      getCategoryName: (category) => category.name_ja,
      translationMode: "dictionary",
      setTranslationMode: jest.fn(),
    });

    useNetworkStatus.mockReturnValue({
      isOnline: true,
      isConnected: true,
    });

    api.getMenuWithTranslation.mockResolvedValue({
      categories: mockCategories,
      items: mockMenuItems,
    });
  });

  test("メニューを正しく表示する", async () => {
    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText("テストレストラン")).toBeTruthy();
      expect(getByText("Table 1")).toBeTruthy();
    });
  });

  test("ローディング中はローディングインジケーターを表示", () => {
    api.getMenuWithTranslation.mockImplementation(
      () => new Promise(() => {}) // 永久に解決しないPromise
    );

    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(getByText("メニューを読み込み中...")).toBeTruthy();
  });

  test("カテゴリを表示する", async () => {
    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText("前菜")).toBeTruthy();
      expect(getByText("メイン")).toBeTruthy();
    });
  });

  test("メニューアイテムを表示する", async () => {
    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText("枝豆")).toBeTruthy();
      expect(getByText("塩茹でした枝豆")).toBeTruthy();
    });
  });

  test("人気バッジを表示する", async () => {
    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText("人気")).toBeTruthy();
    });
  });

  test("メニューアイテムをタップすると詳細画面に遷移", async () => {
    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      const edamameItem = getByText("枝豆");
      fireEvent.press(edamameItem.parent.parent);
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith("ItemDetail", {
      item: expect.objectContaining({ id: "item_01" }),
      restaurantId: "restaurant_01",
      tableId: "table_01",
    });
  });

  test("カートボタンをタップするとカート画面に遷移", async () => {
    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      const cartButton = getByText("🛒 カートを見る");
      fireEvent.press(cartButton);
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Cart", {
      restaurantId: "restaurant_01",
      tableId: "table_01",
      restaurant: mockRoute.params.restaurant,
      table: mockRoute.params.table,
    });
  });

  test("戻るボタンをタップすると前の画面に戻る", async () => {
    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      const backButton = getByText("←");
      fireEvent.press(backButton);
    });

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test("オフライン時に警告バナーを表示", async () => {
    useNetworkStatus.mockReturnValue({
      isOnline: false,
      isConnected: false,
    });

    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText("📡 オフライン - ネットワーク接続を確認")).toBeTruthy();
    });
  });

  test("エラー時にエラーメッセージと再読み込みボタンを表示", async () => {
    api.getMenuWithTranslation.mockRejectedValue(
      new Error("ネットワークエラー")
    );

    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText("ネットワークエラー")).toBeTruthy();
      expect(getByText("再読み込み")).toBeTruthy();
    });
  });

  test("再読み込みボタンをタップするとメニューを再取得", async () => {
    api.getMenuWithTranslation.mockRejectedValueOnce(
      new Error("ネットワークエラー")
    );

    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText("再読み込み")).toBeTruthy();
    });

    // 2回目は成功するようにモックを設定
    api.getMenuWithTranslation.mockResolvedValue({
      categories: mockCategories,
      items: mockMenuItems,
    });

    fireEvent.press(getByText("再読み込み"));

    await waitFor(() => {
      expect(api.getMenuWithTranslation).toHaveBeenCalledTimes(2);
    });
  });

  test("メニューが空の場合、空メッセージを表示", async () => {
    api.getMenuWithTranslation.mockResolvedValue({
      categories: mockCategories,
      items: [],
    });

    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText("このカテゴリにはメニューがありません")).toBeTruthy();
    });
  });

  test("言語が英語の場合、英語でメニューを表示", async () => {
    useLanguage.mockReturnValue({
      currentLanguage: "en",
      getItemName: (item) => item.name_en,
      getItemDescription: (item) => item.description_en || item.description_ja,
      getCategoryName: (category) => category.name_en,
      translationMode: "dictionary",
      setTranslationMode: jest.fn(),
    });

    const { getByText } = render(
      <MenuScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText("Appetizer")).toBeTruthy();
      expect(getByText("Edamame")).toBeTruthy();
    });
  });
});
