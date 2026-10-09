jest.mock("../../hooks/useLanguage");
jest.mock("../../services/api", () => ({ createOrder: jest.fn() }));
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { useLanguage } from "../../hooks/useLanguage";
import { useCart } from "../../hooks/useCart";
import { CartContext } from "../../context/CartContext";
import { translationDisplay } from "../../utils/translationDisplay";
import ItemDetailScreen from "../ItemDetailScreen";
import CartScreen from "../CartScreen";

const scope = { restaurantId: "rest-test", tableId: "table-test" };
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const translatedDish = {
  id: "dish-test",
  name_ja: "親子丼",
  name_en: "Dictionary dish",
  name_en_nodic: "Plain dish",
  price: 1000,
  name_en_translation: {
    schemaVersion: 1,
    sourceText: "親子丼",
    mode: "dictionary",
    status: "ready",
    method: "hybrid",
    usedDictionary: true,
  },
  name_en_nodic_translation: {
    schemaVersion: 1,
    sourceText: "親子丼",
    mode: "deepl_only",
    status: "ready",
    method: "deepl_only",
    usedDictionary: false,
  },
};
function Harness({ screen, item }) {
  const cart = useCart(scope);
  return (
    <CartContext.Provider value={cart}>
      {screen === "detail" ? (
        <ItemDetailScreen
          navigation={navigation}
          route={{ params: { ...scope, item } }}
        />
      ) : (
        <CartScreen navigation={navigation} route={{ params: scope }} />
      )}
    </CartContext.Provider>
  );
}
const language = (mode) =>
  useLanguage.mockReturnValue({
    currentLanguage: "en",
    translationMode: mode,
    getItemName: (item) => translationDisplay(item, "name", "en", mode),
    getItemDescription: () => "",
  });

test("detail additions preserve verified names for both comparison modes in the real cart", () => {
  language("dictionary");
  const view = render(<Harness screen="detail" item={translatedDish} />);
  expect(view.getByText("Dictionary dish")).toBeTruthy();
  fireEvent.press(view.getByText(/Add to Cart/));
  view.rerender(<Harness screen="cart" item={translatedDish} />);
  expect(view.getByText("Dictionary dish")).toBeTruthy();
  expect(view.queryByText(/Translation unverified/)).toBeNull();
  language("deepl_only");
  view.rerender(<Harness screen="cart" item={translatedDish} />);
  expect(view.getByText("Plain dish")).toBeTruthy();
  expect(view.queryByText("Dictionary dish")).toBeNull();
});

test("the detail-to-cart flow keeps missing plain translations distinct from hybrid translations", () => {
  language("dictionary");
  const item = {
    ...translatedDish,
    name_en_nodic: null,
    name_en_nodic_translation: null,
  };
  const view = render(<Harness screen="detail" item={item} />);
  fireEvent.press(view.getByText(/Add to Cart/));
  view.rerender(<Harness screen="cart" item={item} />);
  expect(view.getByText("Dictionary dish")).toBeTruthy();
  language("deepl_only");
  view.rerender(<Harness screen="cart" item={item} />);
  expect(
    view.getByText("親子丼 [Translation unavailable; Japanese original]")
  ).toBeTruthy();
  expect(view.queryByText("Dictionary dish")).toBeNull();
});
