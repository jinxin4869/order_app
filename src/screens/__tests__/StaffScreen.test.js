import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import StaffScreen from "../StaffScreen";
import { observeStaffSession, signInStaff } from "../../services/staffAuth";
import {
  listStaffOrders,
  getStaffOrder,
  updateOrderStatus,
} from "../../services/api";
import { showAlert } from "../../utils/dialogs";
jest.mock("../../services/staffAuth", () => ({
  observeStaffSession: jest.fn(),
  signInStaff: jest.fn(),
  signOutStaff: jest.fn(async () => {}),
}));
jest.mock("../../services/api", () => ({
  listStaffOrders: jest.fn(),
  getStaffOrder: jest.fn(),
  updateOrderStatus: jest.fn(),
}));
jest.mock("../../utils/dialogs", () => ({ showAlert: jest.fn() }));
const order = {
  id: "order-test",
  order_number: "20261009-001",
  table_number: "1",
  status: "pending",
  created_at: 1791504000000,
  total_amount: 1100,
  customer_language: "en",
  items: [
    { name_ja: "テスト料理", quantity: 1, price: 1000, notes: "ねぎ抜き" },
  ],
};
const session = {
  loading: false,
  user: { uid: "staff-test" },
  restaurantId: "rest-test",
};
beforeEach(() => {
  jest.clearAllMocks();
  observeStaffSession.mockImplementation((listener) => {
    listener(session);
    return jest.fn();
  });
  listStaffOrders.mockResolvedValue({
    orders: [order],
    hasMore: false,
    cursor: order.id,
  });
  getStaffOrder.mockResolvedValue({ order });
  updateOrderStatus.mockResolvedValue({ success: true, status: "confirmed" });
});
test("login requires credentials and reports failure without exposing provider errors", async () => {
  observeStaffSession.mockImplementation((listener) => {
    listener({ loading: false, user: null });
    return jest.fn();
  });
  signInStaff.mockRejectedValue(new Error("Synthetic provider detail"));
  const screen = render(<StaffScreen />);
  fireEvent.changeText(
    screen.getByLabelText("メールアドレス"),
    "staff@example.invalid"
  );
  fireEvent.changeText(
    screen.getByLabelText("パスワード"),
    "synthetic-test-password"
  );
  fireEvent.press(screen.getByRole("button", { name: "ログイン" }));
  await waitFor(() =>
    expect(screen.getByText(/ログインできません/)).toBeTruthy()
  );
  expect(signInStaff).toHaveBeenCalledWith(
    "staff@example.invalid",
    "synthetic-test-password"
  );
  expect(screen.getByLabelText("パスワード").props.value).toBe("");
  expect(listStaffOrders).not.toHaveBeenCalled();
});
test("users without staff claims cannot enter the console", () => {
  observeStaffSession.mockImplementation((listener) => {
    listener({
      loading: false,
      user: { uid: "customer" },
      restaurantId: null,
      error: "スタッフ権限がありません。",
    });
    return jest.fn();
  });
  const screen = render(<StaffScreen />);
  expect(screen.getByText("スタッフ権限がありません。")).toBeTruthy();
  expect(listStaffOrders).not.toHaveBeenCalled();
});
test("staff review item notes and confirm a state transition with the displayed prior state", async () => {
  const screen = render(<StaffScreen />);
  fireEvent.press(
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" })
  );
  expect(await screen.findByText("要望：ねぎ抜き")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "注文を受け付ける" }));
  expect(updateOrderStatus).not.toHaveBeenCalled();
  const confirm = showAlert.mock.calls[0][2].find(
    (button) => button.text === "変更する"
  );
  await act(async () => confirm.onPress());
  expect(updateOrderStatus).toHaveBeenCalledWith(
    order.id,
    "confirmed",
    "pending"
  );
  expect(screen.getByText("状態を更新しました。")).toBeTruthy();
});
test("stale updates reload the order and require a fresh choice instead of auto-retrying", async () => {
  const screen = render(<StaffScreen />);
  fireEvent.press(
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" })
  );
  await screen.findByText("要望：ねぎ抜き");
  updateOrderStatus.mockRejectedValue({ code: "functions/aborted" });
  getStaffOrder.mockResolvedValue({ order: { ...order, status: "preparing" } });
  fireEvent.press(screen.getByRole("button", { name: "注文を受け付ける" }));
  await act(async () => showAlert.mock.calls[0][2][1].onPress());
  expect(screen.getByText(/別のスタッフが更新しました/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "提供待ちにする" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "注文を受け付ける" })).toBeNull();
  expect(updateOrderStatus).toHaveBeenCalledTimes(1);
});
test("refresh identifies unseen orders and pagination requests the protected cursor", async () => {
  listStaffOrders.mockResolvedValueOnce({
    orders: [order],
    hasMore: true,
    cursor: order.id,
  });
  const screen = render(<StaffScreen />);
  await screen.findByRole("button", { name: "注文 20261009-001 未受付" });
  listStaffOrders.mockResolvedValueOnce({
    orders: [{ ...order, id: "older", order_number: "20261009-000" }],
    hasMore: false,
    cursor: "older",
  });
  fireEvent.press(
    screen.getByRole("button", { name: "さらに前の注文を読み込む" })
  );
  await screen.findByRole("button", { name: "注文 20261009-000 未受付" });
  expect(listStaffOrders).toHaveBeenLastCalledWith({
    view: "active",
    cursor: order.id,
  });
  listStaffOrders.mockResolvedValueOnce({
    orders: [{ ...order, id: "new", order_number: "20261009-002" }, order],
    hasMore: false,
    cursor: order.id,
  });
  fireEvent.press(screen.getByRole("button", { name: "更新" }));
  expect(
    await screen.findByRole("button", { name: "新着 1件を確認" })
  ).toBeTruthy();
});

test("changing the order filter clears old rows and ignores an earlier in-flight refresh", async () => {
  const screen = render(<StaffScreen />);
  await screen.findByRole("button", { name: "注文 20261009-001 未受付" });
  let resolveOld, resolveNew;
  listStaffOrders.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  fireEvent.press(screen.getByRole("button", { name: "更新" }));
  listStaffOrders.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveNew = resolve;
      })
  );
  fireEvent.press(screen.getByRole("button", { name: "すべて" }));
  expect(
    screen.queryByRole("button", { name: "注文 20261009-001 未受付" })
  ).toBeNull();
  await act(async () =>
    resolveOld({ orders: [order], hasMore: false, cursor: null })
  );
  expect(
    screen.queryByRole("button", { name: "注文 20261009-001 未受付" })
  ).toBeNull();
  await act(async () =>
    resolveNew({
      orders: [{ ...order, id: "completed-order", status: "completed" }],
      hasMore: false,
      cursor: null,
    })
  );
  expect(
    screen.getByRole("button", { name: "注文 20261009-001 対応完了" })
  ).toBeTruthy();
  expect(listStaffOrders).toHaveBeenLastCalledWith({ view: "all" });
});
