import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import OrderHistoryScreen from "../OrderHistoryScreen";
import { CartContext } from "../../context/CartContext";
import { listVisitOrders } from "../../services/api";
import { useLanguage } from "../../hooks/useLanguage";
jest.mock("../../services/api", () => ({ listVisitOrders: jest.fn() }));
jest.mock("../../hooks/useLanguage", () => ({ useLanguage: jest.fn() }));
jest.mock("../../hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));
const route = {
  params: {
    restaurantId: "rest-test",
    tableId: "table-test",
    table: { table_number: "12" },
  },
};
const navigation = { goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) };
const order = (overrides = {}) => ({
  id: "order-1",
  order_number: "20261025-001",
  status: "preparing",
  total_amount: 1100,
  created_at: Date.parse("2026-10-25T03:00:00Z"),
  items: [{ name_ja: "テスト料理", name_en: "Test dish", quantity: 2 }],
  ...overrides,
});
const cart = {
  getVisit: jest.fn(async () => ({ visitId: "visit-a" })),
  startNewVisit: jest.fn(),
};
const show = () =>
  render(
    <CartContext.Provider value={cart}>
      <OrderHistoryScreen navigation={navigation} route={route} />
    </CartContext.Provider>
  );
beforeEach(() => {
  jest.clearAllMocks();
  useLanguage.mockReturnValue({ currentLanguage: "ja" });
});
test("orders of this visit are listed with their progress", async () => {
  listVisitOrders.mockResolvedValue({
    closed: false,
    orders: [
      order(),
      order({ id: "order-0", order_number: "20261025-000", status: "served" }),
    ],
  });
  const screen = await show();
  expect(await screen.findByText("20261025-001")).toBeTruthy();
  expect(screen.getByText("調理中")).toBeTruthy();
  expect(screen.getByText("お届け済み")).toBeTruthy();
  expect(screen.getAllByText("テスト料理 × 2")).toHaveLength(2);
  expect(listVisitOrders).toHaveBeenCalledWith({
    restaurantId: "rest-test",
    tableId: "table-test",
    visitId: "visit-a",
  });
  expect(cart.startNewVisit).not.toHaveBeenCalled();
});
test("English shows translated names and status", async () => {
  useLanguage.mockReturnValue({ currentLanguage: "en" });
  listVisitOrders.mockResolvedValue({ closed: false, orders: [order()] });
  const screen = await show();
  expect(await screen.findByText("Test dish × 2")).toBeTruthy();
  expect(screen.getByText("Preparing")).toBeTruthy();
});
test("a closed visit with no newer orders starts the next visit", async () => {
  listVisitOrders.mockResolvedValue({ closed: true, orders: [] });
  const screen = await show();
  expect(await screen.findByText("前回のご来店は終了しました。")).toBeTruthy();
  expect(
    screen.getByText("この端末から送った注文はまだありません。")
  ).toBeTruthy();
  expect(cart.startNewVisit).toHaveBeenCalledTimes(1);
});
test("a failed load says the list may be out of date and can be retried", async () => {
  listVisitOrders.mockRejectedValueOnce(new Error("offline"));
  const screen = await show();
  expect(
    await screen.findByText(
      "注文履歴を取得できません。表示中の内容は最新ではない可能性があります。"
    )
  ).toBeTruthy();
  expect(
    screen.queryByText("この端末から送った注文はまだありません。")
  ).toBeNull();
  listVisitOrders.mockResolvedValue({ closed: false, orders: [order()] });
  await fireEvent.press(screen.getByRole("button", { name: "更新" }));
  await waitFor(() => expect(screen.getByText("20261025-001")).toBeTruthy());
  expect(
    screen.queryByText(
      "注文履歴を取得できません。表示中の内容は最新ではない可能性があります。"
    )
  ).toBeNull();
});
test("a corrected order shows the staff correction and cancelled lines", async () => {
  listVisitOrders.mockResolvedValue({
    closed: false,
    orders: [
      order({
        corrected: true,
        items: [
          { name_ja: "テスト料理", quantity: 1, original_quantity: 2 },
          { name_ja: "お茶", quantity: 0, original_quantity: 1 },
        ],
      }),
    ],
  });
  const screen = await show();
  expect(
    await screen.findByText("スタッフが注文内容を訂正しました。")
  ).toBeTruthy();
  expect(screen.getByText("テスト料理 × 1（訂正前 2）")).toBeTruthy();
  expect(screen.getByText("お茶 （取消）")).toBeTruthy();
});
