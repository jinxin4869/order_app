jest.mock("../../hooks/useLanguage", () => ({
  useLanguage: () => ({
    currentLanguage: "ja",
    getItemName: (item) => item.name_ja,
    getItemDescription: () => "",
  }),
}));
jest.mock("../../services/api", () => ({ createOrder: jest.fn() }));
import React, { useLayoutEffect } from "react";
import { Text, Alert } from "react-native";
import {
  render,
  fireEvent,
  renderHook,
  act,
} from "@testing-library/react-native";
import { useCart } from "../../hooks/useCart";
import { syncCartRoute } from "../../utils/cartSession";
import { CartContext } from "../../context/CartContext";
import ItemDetailScreen from "../../screens/ItemDetailScreen";
import CartScreen from "../../screens/CartScreen";
import { createOrder } from "../../services/api";

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
};
afterEach(() => jest.restoreAllMocks());
beforeEach(() => jest.clearAllMocks());
const dish = { id: "shared-item", name_ja: "店舗Aの料理", price: 1000 };
const routeFor = (
  name,
  restaurantId = "rest-a",
  tableId = "table-a",
  item = dish
) => ({ name, params: { restaurantId, tableId, item } });
function Harness({ route }) {
  const cart = useCart();
  const { setSession, endSession } = cart;
  // Deliver the same route events that NavigationContainer sends to AppNavigator.
  useLayoutEffect(() => {
    syncCartRoute(route, { setSession, endSession });
  }, [route, setSession, endSession]);
  return (
    <CartContext.Provider value={cart}>
      {route.name === "ItemDetail" ? (
        <ItemDetailScreen route={route} navigation={navigation} />
      ) : route.name === "Cart" ? (
        <CartScreen route={route} navigation={navigation} />
      ) : (
        <Text>{route.name}</Text>
      )}
    </CartContext.Provider>
  );
}
test("navigation preserves the same table cart and discards a different restaurant's items", () => {
  const view = render(<Harness route={routeFor("ItemDetail")} />);
  fireEvent.press(view.getByText("カートに追加"));
  view.rerender(<Harness route={routeFor("Cart")} />);
  expect(view.getByText("店舗Aの料理")).toBeTruthy();
  view.rerender(<Harness route={routeFor("LanguageSelect")} />);
  view.rerender(<Harness route={routeFor("Cart")} />);
  expect(view.getByText("店舗Aの料理")).toBeTruthy();
  view.rerender(
    <Harness
      route={routeFor("ItemDetail", "rest-b", "table-b", {
        ...dish,
        name_ja: "店舗Bの料理",
      })}
    />
  );
  fireEvent.press(view.getByText("カートに追加"));
  view.rerender(<Harness route={routeFor("Cart", "rest-b", "table-b")} />);
  expect(view.queryByText("店舗Aの料理")).toBeNull();
  expect(view.getByText("店舗Bの料理")).toBeTruthy();
  view.rerender(<Harness route={routeFor("Cart", "rest-b", "other-table")} />);
  expect(view.getByText("カートは空です")).toBeTruthy();
});
test("ending a session or starting another table invalidates old item-detail actions", () => {
  const { result } = renderHook(() => useCart());
  expect(result.current.addItem(dish)).toBe(false);
  act(() => result.current.setSession("rest-a", "table-a"));
  act(() => result.current.addItem(dish));
  act(() => result.current.setSession("rest-a", "table-b"));
  expect(result.current.items).toEqual([]);
  expect(
    result.current.addItem(dish, 1, "", {
      restaurantId: "rest-a",
      tableId: "table-a",
    })
  ).toBe(false);
  act(() => result.current.endSession());
  expect(result.current.sessionKey).toBeNull();
});

test.each(["success", "failure"])(
  "a late order %s cannot affect the next table's cart",
  async (outcome) => {
    let resolveOrder, rejectOrder;
    createOrder.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          resolveOrder = resolve;
          rejectOrder = reject;
        })
    );
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation((title, message, buttons) => {
        if (title === "注文確認") buttons[1].onPress();
      });
    const view = render(<Harness route={routeFor("ItemDetail")} />);
    fireEvent.press(view.getByText("カートに追加"));
    view.rerender(<Harness route={routeFor("Cart")} />);
    fireEvent.press(view.getByText("注文を確定する"));
    expect(createOrder).toHaveBeenCalledTimes(1);
    view.rerender(
      <Harness
        route={routeFor("ItemDetail", "rest-b", "table-b", {
          ...dish,
          name_ja: "店舗Bの料理",
        })}
      />
    );
    fireEvent.press(view.getByText("カートに追加"));
    view.rerender(<Harness route={routeFor("Cart", "rest-b", "table-b")} />);
    await act(async () => {
      if (outcome === "success")
        resolveOrder({ orderId: "old-order", orderNumber: "001" });
      else
        rejectOrder(
          Object.assign(new Error("old price changed"), {
            details: { reason: "price_changed" },
          })
        );
    });
    expect(view.getByText("店舗Bの料理")).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
  }
);

test("a price-change prompt opened at the old table cannot clear a new cart", async () => {
  createOrder.mockRejectedValue(
    Object.assign(new Error("price changed"), {
      details: { reason: "price_changed" },
    })
  );
  let openMenu;
  jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
    if (title === "注文確認") buttons[1].onPress();
    if (title === "メニュー更新が必要です") openMenu = buttons[0].onPress;
  });
  const view = render(<Harness route={routeFor("ItemDetail")} />);
  fireEvent.press(view.getByText("カートに追加"));
  view.rerender(<Harness route={routeFor("Cart")} />);
  await act(async () => fireEvent.press(view.getByText("注文を確定する")));
  expect(openMenu).toEqual(expect.any(Function));
  view.rerender(
    <Harness
      route={routeFor("ItemDetail", "rest-b", "table-b", {
        ...dish,
        name_ja: "店舗Bの料理",
      })}
    />
  );
  fireEvent.press(view.getByText("カートに追加"));
  view.rerender(<Harness route={routeFor("Cart", "rest-b", "table-b")} />);
  act(() => openMenu());
  expect(view.getByText("店舗Bの料理")).toBeTruthy();
  expect(navigation.replace).not.toHaveBeenCalled();
});

test("reopening the same table after another session does not revive its pending request", () => {
  const { result } = renderHook(() =>
    useCart({ restaurantId: "rest-a", tableId: "table-a" })
  );
  const data = { restaurantId: "rest-a", tableId: "table-a", items: [] };
  const requestId = result.current.getOrderRequestId(data);
  expect(result.current.isOrderRequestCurrent(requestId)).toBe(true);
  act(() => result.current.setSession("rest-b", "table-b"));
  act(() => result.current.setSession("rest-a", "table-a"));
  expect(result.current.isOrderRequestCurrent(requestId)).toBe(false);
  expect(result.current.getOrderRequestId(data)).not.toBe(requestId);
});
