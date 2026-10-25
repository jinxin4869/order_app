import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import PendingOrderNotice from "../PendingOrderNotice";
import { CartContext } from "../../context/CartContext";
jest.mock("../../hooks/useLanguage", () => ({
  useLanguage: () => ({ currentLanguage: "ja" }),
}));
const session = {
  restaurantId: "rest-test",
  tableId: "table-test",
  restaurant: { name: "店" },
  table: { table_number: "1" },
};
const payload = { requestId: "request-1", totalAmount: 1100 };
const show = (recovery) => {
  const cart = {
    recovery,
    retryRecovery: jest.fn(),
    restoreRecoveredOrder: jest.fn(),
    dismissRecovery: jest.fn(),
  };
  const navigation = { navigate: jest.fn() };
  return {
    cart,
    navigation,
    view: render(
      <CartContext.Provider value={cart}>
        <PendingOrderNotice navigation={navigation} session={session} />
      </CartContext.Provider>
    ),
  };
};
test("nothing is shown without a pending order", async () => {
  const { view } = show(null);
  expect((await view).toJSON()).toBeNull();
});
test("an accepted order opens its completion screen", async () => {
  const { cart, navigation, view } = show({
    state: "accepted",
    payload,
    result: { orderId: "order-1", orderNumber: "20261025-001" },
  });
  const screen = await view;
  expect(
    screen.getByText(
      "前回の注文は受け付けられています（注文番号 20261025-001）。"
    )
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "注文内容を見る" }));
  expect(navigation.navigate).toHaveBeenCalledWith("OrderComplete", {
    ...session,
    orderId: "order-1",
    orderNumber: "20261025-001",
    total: 1100,
  });
  expect(cart.dismissRecovery).toHaveBeenCalled();
});
test("an order that was not accepted can be put back or discarded", async () => {
  const { cart, view } = show({ state: "not_accepted", payload });
  const screen = await view;
  await fireEvent.press(screen.getByRole("button", { name: "カートに戻す" }));
  expect(cart.restoreRecoveredOrder).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "破棄する" }));
  expect(cart.dismissRecovery).toHaveBeenCalled();
});
test("checking shows no actions, and a failed check offers only a retry", async () => {
  const checking = await show({ state: "checking", payload }).view;
  expect(
    checking.getByText("前回の注文の受付状況を確認しています…")
  ).toBeTruthy();
  expect(checking.queryByRole("button")).toBeNull();
  const { cart, view } = show({ state: "error", payload });
  const failed = await view;
  expect(failed.getAllByRole("button")).toHaveLength(1);
  await fireEvent.press(
    failed.getByRole("button", { name: "もう一度確認する" })
  );
  expect(cart.retryRecovery).toHaveBeenCalled();
});
