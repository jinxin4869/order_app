import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import OrderCorrection from "../OrderCorrection";
import { correctOrderItems } from "../../services/api";
import { showAlert } from "../../utils/dialogs";
jest.mock("../../services/api", () => ({ correctOrderItems: jest.fn() }));
jest.mock("../../utils/dialogs", () => ({ showAlert: jest.fn() }));
const order = (overrides = {}) => ({
  id: "order-1",
  order_number: "20261025-001",
  status: "confirmed",
  revision: 2,
  total_amount: 2200,
  items: [
    { name_ja: "唐揚げ", quantity: 3, price: 600 },
    { name_ja: "お茶", quantity: 1, price: 200 },
  ],
  ...overrides,
});
const confirm = async () => {
  const button = showAlert.mock.calls
    .at(-1)[2]
    .find((b) => b.text === "訂正する");
  await act(async () => button.onPress());
};
beforeEach(() => jest.clearAllMocks());
test("staff reduce lines with a reason, see the estimate, and confirm", async () => {
  correctOrderItems.mockResolvedValue({
    success: true,
    status: "confirmed",
    total_amount: 880,
    revision: 3,
  });
  const onDone = jest.fn();
  const screen = await render(
    <OrderCorrection order={order()} onDone={onDone} />
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "数量を訂正する（減数・取消）" })
  );
  const save = screen.getByRole("button", { name: "訂正を保存" });
  expect(save.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(
    screen.getByRole("button", { name: "唐揚げを1つ減らす" })
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "唐揚げを1つ減らす" })
  );
  expect(screen.getByText("合計（目安）：¥2,200 → ¥880")).toBeTruthy();
  // A reason is required before saving.
  expect(
    screen.getByRole("button", { name: "訂正を保存" }).props.accessibilityState
      .disabled
  ).toBe(true);
  await fireEvent.changeText(
    screen.getByLabelText("訂正の理由（必須）"),
    " 品切れ "
  );
  await fireEvent.press(screen.getByRole("button", { name: "訂正を保存" }));
  expect(showAlert.mock.calls[0][1]).toContain("唐揚げ：3 → 1");
  await confirm();
  expect(correctOrderItems).toHaveBeenCalledWith({
    orderId: "order-1",
    expectedRevision: 2,
    changes: [{ index: 0, quantity: 1 }],
    reason: "品切れ",
    operationId: expect.any(String),
  });
  expect(onDone).toHaveBeenCalledWith("訂正しました。合計は¥880です。");
});
test("cancelling everything warns that the order will be cancelled", async () => {
  correctOrderItems.mockResolvedValue({ status: "cancelled", total_amount: 0 });
  const onDone = jest.fn();
  const screen = await render(
    <OrderCorrection order={order()} onDone={onDone} />
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "数量を訂正する（減数・取消）" })
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "唐揚げを取り消す" })
  );
  await fireEvent.press(screen.getByRole("button", { name: "お茶を取り消す" }));
  await fireEvent.changeText(
    screen.getByLabelText("訂正の理由（必須）"),
    "お客様の依頼"
  );
  await fireEvent.press(screen.getByRole("button", { name: "訂正を保存" }));
  expect(showAlert.mock.calls[0][1]).toContain("注文はキャンセルになります");
  await confirm();
  expect(onDone).toHaveBeenCalledWith(
    "すべての商品を取り消し、注文をキャンセルしました。"
  );
});
test("a conflict or an unknown result reloads instead of assuming success", async () => {
  correctOrderItems.mockRejectedValueOnce(
    Object.assign(new Error("x"), { code: "functions/aborted" })
  );
  const onDone = jest.fn();
  const screen = await render(
    <OrderCorrection order={order()} onDone={onDone} />
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "数量を訂正する（減数・取消）" })
  );
  await fireEvent.press(screen.getByRole("button", { name: "お茶を取り消す" }));
  await fireEvent.changeText(
    screen.getByLabelText("訂正の理由（必須）"),
    "理由"
  );
  await fireEvent.press(screen.getByRole("button", { name: "訂正を保存" }));
  await confirm();
  expect(onDone).toHaveBeenCalledWith(
    expect.stringContaining("別のスタッフが注文を更新しました")
  );
});
test.each(["ready", "served", "completed", "cancelled"])(
  "an order that is %s offers no correction",
  async (status) => {
    const screen = await render(
      <OrderCorrection order={order({ status })} onDone={jest.fn()} />
    );
    expect(screen.toJSON()).toBeNull();
  }
);
