import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import StaffStats from "../StaffStats";
import { getDailyStats } from "../../services/api";
import { businessDay } from "../../../functions/src/utils/businessDay";
jest.mock("../../services/api", () => ({ getDailyStats: jest.fn() }));
const today = businessDay();
const stats = (overrides = {}) => ({
  day: today,
  generatedAt: Date.parse("2026-10-25T05:00:00Z"),
  truncated: false,
  orders: { total: 6, active: 5, cancelled: 1, corrected: 1, served: 4 },
  itemQuantity: 10,
  popular: [
    { item_id: "edamame", name_ja: "枝豆", quantity: 4, orders: 1 },
    { item_id: "tea", name_ja: "お茶", quantity: 3, orders: 3 },
  ],
  durations: {
    orderToServed: {
      count: 3,
      missing: 1,
      medianMinutes: 15,
      averageMinutes: 15,
    },
    confirmedToServed: {
      count: 0,
      missing: 4,
      medianMinutes: null,
      averageMinutes: null,
    },
  },
  ...overrides,
});
beforeEach(() => {
  jest.clearAllMocks();
  getDailyStats.mockImplementation(async (day) => stats({ day }));
});
test("today's figures are shown with what they include", async () => {
  const screen = await render(<StaffStats />);
  expect(await screen.findByText("注文 5件")).toBeTruthy();
  expect(getDailyStats).toHaveBeenCalledWith(today);
  expect(
    screen.getByText(/受付 6件（キャンセル 1件、訂正あり 1件）/)
  ).toBeTruthy();
  expect(screen.getByText("商品 10点")).toBeTruthy();
  expect(screen.getByText("1. 枝豆 — 4点（1件の注文）")).toBeTruthy();
  expect(
    screen.getByText(
      "注文から提供：中央値 15分（平均 15分、3件、時刻の記録なし 1件）"
    )
  ).toBeTruthy();
  expect(
    screen.getByText("受付から提供：記録がありません（時刻の記録なし 4件）")
  ).toBeTruthy();
  expect(screen.getByText(/会計上の売上ではありません/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "翌日" }).props.accessibilityState
      .disabled
  ).toBe(true);
});
test("staff can step back a day, and an empty day says so", async () => {
  const screen = await render(<StaffStats />);
  await screen.findByText("注文 5件");
  getDailyStats.mockImplementation(async (day) =>
    stats({
      day,
      orders: { total: 0, active: 0, cancelled: 0, corrected: 0, served: 0 },
    })
  );
  await fireEvent.press(screen.getByRole("button", { name: "前日" }));
  expect(await screen.findByText("この日の注文はありません。")).toBeTruthy();
  const previous = getDailyStats.mock.calls.at(-1)[0];
  expect(previous).not.toBe(today);
  expect(previous).toMatch(/^\d{8}$/);
  expect(
    screen.getByRole("button", { name: "翌日" }).props.accessibilityState
      .disabled
  ).toBe(false);
});
test("a capped or failed calculation is made visible", async () => {
  getDailyStats.mockImplementationOnce(async (day) =>
    stats({ day, truncated: true })
  );
  const screen = await render(<StaffStats />);
  expect(
    await screen.findByText(
      "注文が多いため、最初の2,000件だけを集計しています。"
    )
  ).toBeTruthy();
  getDailyStats.mockRejectedValueOnce(new Error("offline"));
  await fireEvent.press(screen.getByRole("button", { name: "更新" }));
  await waitFor(() =>
    expect(
      screen.getByText(
        "集計できません。接続を確認して「更新」を押してください。"
      )
    ).toBeTruthy()
  );
});
