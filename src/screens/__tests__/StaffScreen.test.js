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
  closeTableVisit: jest.fn(),
  correctOrderItems: jest.fn(),
  getDailyStats: jest.fn(async (day) => ({
    day,
    generatedAt: Date.now(),
    truncated: false,
    orders: { total: 0, active: 0, cancelled: 0, corrected: 0, served: 0 },
    itemQuantity: 0,
    popular: [],
    durations: {
      orderToServed: {
        count: 0,
        missing: 0,
        medianMinutes: null,
        averageMinutes: null,
      },
      confirmedToServed: {
        count: 0,
        missing: 0,
        medianMinutes: null,
        averageMinutes: null,
      },
    },
  })),
  getStaffMenu: jest.fn(async () => ({
    restaurant: { name: "テスト店", ordering: "open", version: 0 },
    categories: [],
    items: [],
  })),
}));
jest.mock("../../utils/dialogs", () => ({ showAlert: jest.fn() }));
jest.mock("../../hooks/useNetworkStatus", () => ({
  useNetworkStatus: jest.fn(() => ({ isOnline: true })),
}));
jest.mock("../../utils/newOrderAlert", () => ({
  enableAlertSound: jest.fn(() => true),
  disableAlertSound: jest.fn(),
  playNewOrderAlert: jest.fn(),
  showTitleBadge: jest.fn(),
}));
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
  const screen = await render(<StaffScreen />);
  await fireEvent.changeText(
    screen.getByLabelText("メールアドレス"),
    "staff@example.invalid"
  );
  await fireEvent.changeText(
    screen.getByLabelText("パスワード"),
    "synthetic-test-password"
  );
  await fireEvent.press(screen.getByRole("button", { name: "ログイン" }));
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
test("users without staff claims cannot enter the console", async () => {
  observeStaffSession.mockImplementation((listener) => {
    listener({
      loading: false,
      user: { uid: "customer" },
      restaurantId: null,
      error: "スタッフ権限がありません。",
    });
    return jest.fn();
  });
  const screen = await render(<StaffScreen />);
  expect(screen.getByText("スタッフ権限がありません。")).toBeTruthy();
  expect(listStaffOrders).not.toHaveBeenCalled();
});
test("staff review item notes and confirm a state transition with the displayed prior state", async () => {
  const screen = await render(<StaffScreen />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" })
  );
  expect(await screen.findByText("要望：ねぎ抜き")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "注文を受け付ける" })
  );
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
  const screen = await render(<StaffScreen />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" })
  );
  await screen.findByText("要望：ねぎ抜き");
  updateOrderStatus.mockRejectedValue({ code: "functions/aborted" });
  getStaffOrder.mockResolvedValue({ order: { ...order, status: "preparing" } });
  await fireEvent.press(
    screen.getByRole("button", { name: "注文を受け付ける" })
  );
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
  const screen = await render(<StaffScreen />);
  await screen.findByRole("button", { name: "注文 20261009-001 未受付" });
  listStaffOrders.mockResolvedValueOnce({
    orders: [{ ...order, id: "older", order_number: "20261009-000" }],
    hasMore: false,
    cursor: "older",
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "さらに前の注文を読み込む" })
  );
  await screen.findByRole("button", { name: "注文 20261009-000 未受付" });
  expect(listStaffOrders).toHaveBeenLastCalledWith({
    view: "active",
    sort: "newest",
    cursor: order.id,
  });
  listStaffOrders.mockResolvedValueOnce({
    orders: [{ ...order, id: "new", order_number: "20261009-002" }, order],
    hasMore: false,
    cursor: order.id,
  });
  await fireEvent.press(screen.getByRole("button", { name: "更新" }));
  expect(
    await screen.findByRole("button", { name: "新着 1件を確認" })
  ).toBeTruthy();
});

test("changing the order filter clears old rows and ignores an earlier in-flight refresh", async () => {
  const screen = await render(<StaffScreen />);
  await screen.findByRole("button", { name: "注文 20261009-001 未受付" });
  let resolveOld, resolveNew;
  listStaffOrders.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  // RNTL 14's fireEvent resolves with the handler's promise, and both
  // requests are held open on purpose. Await each one after resolving it.
  const refresh = fireEvent.press(screen.getByRole("button", { name: "更新" }));
  // Let fireEvent's own act() finish before starting the next one.
  await new Promise((resolve) => setTimeout(resolve, 0));
  listStaffOrders.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveNew = resolve;
      })
  );
  const showAll = fireEvent.press(
    screen.getByRole("button", { name: "すべて" })
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(
    screen.queryByRole("button", { name: "注文 20261009-001 未受付" })
  ).toBeNull();
  await act(async () =>
    resolveOld({ orders: [order], hasMore: false, cursor: null })
  );
  await refresh;
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
  await showAll;
  expect(
    screen.getByRole("button", { name: "注文 20261009-001 対応完了" })
  ).toBeTruthy();
  expect(listStaffOrders).toHaveBeenLastCalledWith({
    view: "all",
    sort: "newest",
  });
});
const newOrder = { ...order, id: "new", order_number: "20261009-002" };
const receiveNewOrder = async (screen) => {
  listStaffOrders.mockResolvedValueOnce({
    orders: [newOrder, order],
    hasMore: false,
    cursor: order.id,
  });
  await fireEvent.press(screen.getByRole("button", { name: "更新" }));
  return screen.findByRole("button", { name: "新着 1件を確認" });
};
test("on a phone, checking new orders leaves the detail and keeps each new row marked until opened", async () => {
  const screen = await render(<StaffScreen />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" })
  );
  await screen.findByText("要望：ねぎ抜き");
  await fireEvent.press(await receiveNewOrder(screen));
  expect(screen.queryByRole("button", { name: "一覧に戻る" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: /^新着 \d+件を確認$/ })
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "注文 20261009-002 未受付 新着" })
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "注文 20261009-001 未受付" })
  ).toBeTruthy();
  getStaffOrder.mockResolvedValueOnce({ order: newOrder });
  await fireEvent.press(
    screen.getByRole("button", { name: "注文 20261009-002 未受付 新着" })
  );
  await fireEvent.press(
    await screen.findByRole("button", { name: "一覧に戻る" })
  );
  expect(
    await screen.findByRole("button", { name: "注文 20261009-002 未受付" })
  ).toBeTruthy();
  expect(screen.queryByText("新着")).toBeNull();
});
test("on a wide screen, checking new orders keeps the open detail beside the list", async () => {
  const RN = require("react-native");
  const wide = jest
    .spyOn(RN, "useWindowDimensions", "get")
    .mockReturnValue(() => ({
      width: 1200,
      height: 900,
      scale: 1,
      fontScale: 1,
    }));
  const screen = await render(<StaffScreen />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" })
  );
  await screen.findByText("要望：ねぎ抜き");
  await fireEvent.press(await receiveNewOrder(screen));
  expect(screen.getByText("要望：ねぎ抜き")).toBeTruthy();
  expect(screen.getByText("新着")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: /^新着 \d+件を確認$/ })
  ).toBeNull();
  wide.mockRestore();
});
test("rows and details show the table number, or the ID when an old order has none", async () => {
  const legacy = {
    ...order,
    id: "order-legacy",
    order_number: "20261009-002",
    table_id: "table-old",
    table_number: null,
  };
  listStaffOrders.mockResolvedValue({
    orders: [{ ...order, table_id: "table-test" }, legacy],
    hasMore: false,
    cursor: legacy.id,
  });
  getStaffOrder.mockResolvedValue({ order: legacy });
  const screen = await render(<StaffScreen />);
  expect(await screen.findByText(/^テーブル 1 ·/)).toBeTruthy();
  expect(
    screen.getByText(/^テーブル番号未記録（ID: table-old） ·/)
  ).toBeTruthy();
  expect(screen.queryByText(/テーブル table-test/)).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "注文 20261009-002 未受付" })
  );
  expect(
    await screen.findByText("テーブル番号未記録（ID: table-old） · 未受付")
  ).toBeTruthy();
});
test("the detail lists the status history with staff and reason", async () => {
  getStaffOrder.mockResolvedValue({
    order: {
      ...order,
      status: "cancelled",
      history: [
        {
          from_status: "pending",
          to_status: "confirmed",
          staff_email: "staff@example.invalid",
          reason: null,
          created_at: 1791504060000,
        },
        {
          from_status: "confirmed",
          to_status: "cancelled",
          staff_email: null,
          reason: "品切れ",
          created_at: 1791504120000,
        },
      ],
    },
  });
  const screen = await render(<StaffScreen />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" })
  );
  expect(await screen.findByText("操作履歴")).toBeTruthy();
  expect(screen.getByText("未受付 → 受付済み")).toBeTruthy();
  expect(screen.getByText(/staff@example\.invalid/)).toBeTruthy();
  expect(screen.getByText("受付済み → キャンセル")).toBeTruthy();
  expect(screen.getByText(/スタッフ不明/)).toBeTruthy();
  expect(screen.getByText("理由：品切れ")).toBeTruthy();
  expect(screen.queryByLabelText("キャンセル理由（任意）")).toBeNull();
});
test("a cancellation sends the optional reason the staff typed", async () => {
  const screen = await render(<StaffScreen />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" })
  );
  expect(await screen.findByText("まだ状態の変更はありません。")).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("キャンセル理由（任意）"),
    "  品切れ  "
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "注文をキャンセルする" })
  );
  expect(showAlert.mock.calls[0][1]).toContain("理由：品切れ");
  const confirm = showAlert.mock.calls[0][2].find(
    (button) => button.text === "変更する"
  );
  await act(async () => confirm.onPress());
  expect(updateOrderStatus).toHaveBeenCalledWith(
    order.id,
    "cancelled",
    "pending",
    "品切れ"
  );
});
const alerts = require("../../utils/newOrderAlert");
const { useNetworkStatus } = require("../../hooks/useNetworkStatus");
test("waiting-time order, store-wide pending count, elapsed minutes and long waits", async () => {
  listStaffOrders.mockResolvedValue({
    orders: [{ ...order, created_at: Date.now() - 12 * 60000 }],
    hasMore: false,
    cursor: order.id,
    pendingCount: 3,
  });
  const screen = await render(<StaffScreen />);
  expect(await screen.findByText("未受付 3件（店舗全体）")).toBeTruthy();
  expect(screen.getByText(/経過 12分 · 待ち時間が長い注文/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "待ち時間順" }));
  await waitFor(() =>
    expect(listStaffOrders).toHaveBeenLastCalledWith({
      view: "active",
      sort: "oldest",
    })
  );
});
test("filters narrow the loaded rows and say what they hide", async () => {
  listStaffOrders.mockResolvedValue({
    orders: [
      order,
      {
        ...order,
        id: "order-2",
        order_number: "20261009-002",
        table_number: "2",
        status: "preparing",
      },
    ],
    hasMore: false,
    cursor: "order-2",
    pendingCount: 1,
  });
  const screen = await render(<StaffScreen />);
  await screen.findByRole("button", { name: "注文 20261009-002 調理中" });
  await fireEvent.press(screen.getByRole("button", { name: "調理中" }));
  expect(
    screen.queryByRole("button", { name: "注文 20261009-001 未受付" })
  ).toBeNull();
  expect(screen.getByText(/読み込み済みの2件のうち1件を表示/)).toBeTruthy();
  expect(screen.getByText("未受付 1件（店舗全体）")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "状態：すべて" }));
  await fireEvent.changeText(
    screen.getByLabelText("テーブル番号で絞り込み"),
    "1"
  );
  expect(
    screen.getByRole("button", { name: "注文 20261009-001 未受付" })
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "注文 20261009-002 調理中" })
  ).toBeNull();
});
test("sound plays only for orders that arrive after the staff enabled it", async () => {
  const screen = await render(<StaffScreen />);
  await screen.findByRole("button", { name: "注文 20261009-001 未受付" });
  expect(alerts.playNewOrderAlert).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "通知音をオンにする" })
  );
  expect(alerts.enableAlertSound).toHaveBeenCalled();
  expect(alerts.playNewOrderAlert).toHaveBeenCalledTimes(1);
  listStaffOrders.mockResolvedValueOnce({
    orders: [{ ...order, id: "new", order_number: "20261009-002" }, order],
    hasMore: true,
    cursor: order.id,
  });
  await fireEvent.press(screen.getByRole("button", { name: "更新" }));
  await screen.findByRole("button", { name: "新着 1件を確認" });
  expect(alerts.playNewOrderAlert).toHaveBeenCalledTimes(2);
  expect(alerts.showTitleBadge).toHaveBeenLastCalledWith(1);
  listStaffOrders.mockResolvedValueOnce({
    orders: [{ ...order, id: "older", order_number: "20261009-000" }],
    hasMore: false,
    cursor: "older",
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "さらに前の注文を読み込む" })
  );
  await screen.findByRole("button", { name: "注文 20261009-000 未受付" });
  expect(alerts.playNewOrderAlert).toHaveBeenCalledTimes(2);
  await fireEvent.press(screen.getByRole("button", { name: "通知音：オン" }));
  expect(alerts.disableAlertSound).toHaveBeenCalled();
});
test("without sound support the staff are told to watch the screen", async () => {
  alerts.enableAlertSound.mockReturnValueOnce(false);
  const screen = await render(<StaffScreen />);
  await screen.findByRole("button", { name: "注文 20261009-001 未受付" });
  await fireEvent.press(
    screen.getByRole("button", { name: "通知音をオンにする" })
  );
  expect(screen.getByText(/この端末では通知音を使えません/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "通知音をオンにする" })
  ).toBeTruthy();
});
test("offline is shown, and coming back online or to the app fetches at once", async () => {
  // Record the handler without replacing AppState's own (mock) behaviour.
  const { AppState } = require("react-native");
  const listen = jest.spyOn(AppState, "addEventListener");
  useNetworkStatus.mockReturnValue({ isOnline: false });
  const screen = await render(<StaffScreen />);
  expect(
    await screen.findByText(/オフラインです。注文を取得できません。/)
  ).toBeTruthy();
  const calls = listStaffOrders.mock.calls.length;
  useNetworkStatus.mockReturnValue({ isOnline: true });
  await screen.rerender(<StaffScreen />);
  await waitFor(() =>
    expect(listStaffOrders.mock.calls.length).toBe(calls + 1)
  );
  expect(screen.queryByText(/オフラインです/)).toBeNull();
  const onAppState = listen.mock.calls.find(([type]) => type === "change")[1];
  await act(async () => onAppState("active"));
  await waitFor(() =>
    expect(listStaffOrders.mock.calls.length).toBe(calls + 2)
  );
  useNetworkStatus.mockReturnValue({ isOnline: true });
});
test("staff can end the table's visit after confirming", async () => {
  const { closeTableVisit } = require("../../services/api");
  closeTableVisit.mockResolvedValue({ success: true });
  getStaffOrder.mockResolvedValue({
    order: { ...order, table_id: "table-test" },
  });
  const screen = await render(<StaffScreen />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" })
  );
  await fireEvent.press(
    await screen.findByRole("button", {
      name: "このテーブルの来店を終了する",
    })
  );
  expect(closeTableVisit).not.toHaveBeenCalled();
  const confirm = showAlert.mock.calls[0][2].find(
    (button) => button.text === "終了する"
  );
  await act(async () => confirm.onPress());
  expect(closeTableVisit).toHaveBeenCalledWith("table-test");
  expect(screen.getByText("テーブル 1の来店を終了しました。")).toBeTruthy();
});
test("menu management opens beside the order console, and new orders bring staff back", async () => {
  const { AppState } = require("react-native");
  const listen = jest.spyOn(AppState, "addEventListener");
  const screen = await render(<StaffScreen />);
  await screen.findByRole("button", { name: "注文 20261009-001 未受付" });
  await fireEvent.press(screen.getByRole("button", { name: "メニュー管理" }));
  expect(await screen.findByText("テスト店：注文受付中")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "注文 20261009-001 未受付" })
  ).toBeNull();
  listStaffOrders.mockResolvedValueOnce({
    orders: [{ ...order, id: "new", order_number: "20261009-002" }, order],
    hasMore: false,
    cursor: order.id,
  });
  // Order polling keeps running in menu mode (here: the app comes back).
  const onAppState = listen.mock.calls.find(([type]) => type === "change")[1];
  await act(async () => onAppState("active"));
  await fireEvent.press(
    await screen.findByRole("button", { name: "新着 1件を確認" })
  );
  expect(
    await screen.findByRole("button", { name: "注文 20261009-002 未受付 新着" })
  ).toBeTruthy();
});
test("order-limit hits this hour are shown with the advice to pause", async () => {
  listStaffOrders.mockResolvedValue({
    orders: [order],
    hasMore: false,
    cursor: order.id,
    limitAlert: {
      count: 2,
      enforced: true,
      lastTableNumber: "12",
      lastTableId: "table-test",
      lastAt: Date.now(),
    },
  });
  const screen = await render(<StaffScreen />);
  expect(
    await screen.findByText(
      /直近1時間に、短時間の連続注文の制限が2回ありました（最後：テーブル 12）。該当の注文は受け付けていません。/
    )
  ).toBeTruthy();
});
test("corrected orders are flagged in the list and show what changed", async () => {
  const corrected = {
    ...order,
    corrected: true,
    revision: 1,
    status: "confirmed",
    items: [
      { name_ja: "テスト料理", quantity: 1, original_quantity: 3, price: 1000 },
      { name_ja: "お茶", quantity: 0, original_quantity: 1, price: 200 },
    ],
    corrections: [
      {
        changes: [{ name_ja: "テスト料理", from: 3, to: 1 }],
        total_before: 3520,
        total_after: 1100,
        reason: "品切れ",
        staff_email: "staff@example.invalid",
        created_at: Date.now(),
      },
    ],
  };
  listStaffOrders.mockResolvedValue({
    orders: [corrected],
    hasMore: false,
    cursor: order.id,
  });
  getStaffOrder.mockResolvedValue({ order: corrected });
  const screen = await render(<StaffScreen />);
  expect(await screen.findByText(/訂正あり/)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "注文 20261009-001 受付済み" })
  );
  expect(await screen.findByText("訂正：3 → 1")).toBeTruthy();
  expect(screen.getByText("取消")).toBeTruthy();
  expect(screen.getByText("訂正履歴")).toBeTruthy();
  expect(screen.getByText("テスト料理 3 → 1")).toBeTruthy();
  expect(screen.getByText("理由：品切れ")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "数量を訂正する（減数・取消）" })
  ).toBeTruthy();
});
test("an order-fetch outage over a minute is announced once, then its recovery", async () => {
  jest.useFakeTimers();
  try {
    const screen = await render(<StaffScreen />);
    await screen.findByRole("button", { name: "注文 20261009-001 未受付" });
    listStaffOrders.mockRejectedValue(new Error("offline"));
    await fireEvent.press(screen.getByRole("button", { name: "更新" }));
    expect(screen.queryByText(/分以上止まっています/)).toBeNull();
    await act(async () => jest.advanceTimersByTime(61000));
    expect(
      screen.getAllByText(/注文の取得が1分以上止まっています/)
    ).toHaveLength(1);
    // Switching tabs keeps the warning in view.
    await fireEvent.press(screen.getByRole("button", { name: "集計" }));
    expect(screen.getByText(/分以上止まっています/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "注文受付" }));
    listStaffOrders.mockResolvedValue({
      orders: [order],
      hasMore: false,
      cursor: order.id,
    });
    await fireEvent.press(screen.getByRole("button", { name: "更新" }));
    expect(await screen.findByText(/注文の取得が回復しました/)).toBeTruthy();
    expect(screen.queryByText(/分以上止まっています/)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "確認しました" }));
    expect(screen.queryByText(/回復しました/)).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});
test("a short blip is not announced as an outage", async () => {
  const screen = await render(<StaffScreen />);
  await screen.findByRole("button", { name: "注文 20261009-001 未受付" });
  listStaffOrders.mockRejectedValueOnce(new Error("blip"));
  await fireEvent.press(screen.getByRole("button", { name: "更新" }));
  await fireEvent.press(screen.getByRole("button", { name: "更新" }));
  await waitFor(() =>
    expect(screen.queryByText(/注文を取得できません/)).toBeNull()
  );
  expect(screen.queryByText(/回復しました/)).toBeNull();
});
