/**
 * LanguageSelectScreenのテスト
 */

jest.mock("../../hooks/useLanguage");

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import LanguageSelectScreen from "../LanguageSelectScreen";
import { useLanguage } from "../../hooks/useLanguage";

const mockNavigation = {
  navigate: jest.fn(),
};

const mockRoute = {
  params: {
    restaurantId: "restaurant_01",
    tableId: "table_01",
    restaurant: { name: "テストレストラン" },
    table: { table_number: "1" },
  },
};

const mockAvailableLanguages = [
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
];

describe("LanguageSelectScreen", () => {
  let mockChangeLanguage;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChangeLanguage = jest.fn();

    useLanguage.mockReturnValue({
      changeLanguage: mockChangeLanguage,
      availableLanguages: mockAvailableLanguages,
    });
  });

  it("言語選択画面が正しくレンダリングされる", async () => {
    const { getByText } = await render(
      <LanguageSelectScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(getByText("言語を選択してください")).toBeTruthy();
    expect(getByText("Select your language")).toBeTruthy();
    expect(getByText("请选择语言")).toBeTruthy();
  });

  it("レストラン名とテーブル番号が表示される", async () => {
    const { getByText } = await render(
      <LanguageSelectScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(getByText("テストレストラン")).toBeTruthy();
    expect(getByText(/Table\s*1/)).toBeTruthy();
  });

  it("利用可能な言語がすべて表示される", async () => {
    const { getAllByText, getByText } = await render(
      <LanguageSelectScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(getByText("日本語")).toBeTruthy();
    // "English" appears multiple times (in header and as button text)
    expect(getAllByText("English").length).toBeGreaterThanOrEqual(1);
    expect(getByText("中文")).toBeTruthy();

    expect(getByText("🇯🇵")).toBeTruthy();
    expect(getByText("🇺🇸")).toBeTruthy();
    expect(getByText("🇨🇳")).toBeTruthy();
  });

  it("日本語を選択するとchangeLanguageが呼ばれてMenuに遷移する", async () => {
    const { getByText } = await render(
      <LanguageSelectScreen navigation={mockNavigation} route={mockRoute} />
    );

    const japaneseButton = getByText("日本語");
    await fireEvent.press(japaneseButton);

    expect(mockChangeLanguage).toHaveBeenCalledWith("ja");
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Menu", {
      restaurantId: "restaurant_01",
      tableId: "table_01",
      restaurant: { name: "テストレストラン" },
      table: { table_number: "1" },
    });
  });

  it("英語を選択するとchangeLanguageが呼ばれてMenuに遷移する", async () => {
    const { getAllByText } = await render(
      <LanguageSelectScreen navigation={mockNavigation} route={mockRoute} />
    );

    // "English" is used for both the button text and the language name
    const englishButtons = getAllByText("English");
    await fireEvent.press(englishButtons[0]);

    expect(mockChangeLanguage).toHaveBeenCalledWith("en");
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Menu", {
      restaurantId: "restaurant_01",
      tableId: "table_01",
      restaurant: { name: "テストレストラン" },
      table: { table_number: "1" },
    });
  });

  it("中国語を選択するとchangeLanguageが呼ばれてMenuに遷移する", async () => {
    const { getByText } = await render(
      <LanguageSelectScreen navigation={mockNavigation} route={mockRoute} />
    );

    const chineseButton = getByText("中文");
    await fireEvent.press(chineseButton);

    expect(mockChangeLanguage).toHaveBeenCalledWith("zh");
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Menu", {
      restaurantId: "restaurant_01",
      tableId: "table_01",
      restaurant: { name: "テストレストラン" },
      table: { table_number: "1" },
    });
  });

  it("restaurantがない場合はデフォルト名が表示される", async () => {
    const routeWithoutRestaurant = {
      params: {
        ...mockRoute.params,
        restaurant: null,
      },
    };

    const { getByText } = await render(
      <LanguageSelectScreen
        navigation={mockNavigation}
        route={routeWithoutRestaurant}
      />
    );

    expect(getByText("レストラン")).toBeTruthy();
  });

  it("tableがない場合はtableIdが表示される", async () => {
    const routeWithoutTable = {
      params: {
        ...mockRoute.params,
        table: null,
      },
    };

    const { getByText } = await render(
      <LanguageSelectScreen
        navigation={mockNavigation}
        route={routeWithoutTable}
      />
    );

    expect(getByText(/Table\s*table_01/)).toBeTruthy();
  });

  it("フッターテキストが表示される", async () => {
    const { getByText } = await render(
      <LanguageSelectScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(getByText("Powered by QR Order System")).toBeTruthy();
  });
});
