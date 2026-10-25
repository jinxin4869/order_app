import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import StaffMenuManager from "../StaffMenuManager";
import {
  getStaffMenu,
  setMenuItemAvailability,
  setOrderingAvailability,
  batchTranslateMenu,
} from "../../services/api";
import { showAlert } from "../../utils/dialogs";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
jest.mock("../../services/api", () => ({
  getStaffMenu: jest.fn(),
  setMenuItemAvailability: jest.fn(),
  setOrderingAvailability: jest.fn(),
  batchTranslateMenu: jest.fn(),
  getEditableMenuItem: jest.fn(async () => ({
    item: {
      id: "a",
      name_ja: "唐揚げ",
      description_ja: "",
      price: 600,
      image_url: null,
      allergens: [],
      version: 0,
    },
    draft: null,
  })),
}));
jest.mock("../../utils/dialogs", () => ({ showAlert: jest.fn() }));
jest.mock("../../hooks/useNetworkStatus", () => ({
  useNetworkStatus: jest.fn(() => ({ isOnline: true })),
}));
const menu = (overrides = {}) => ({
  restaurant: { name: "テスト店", ordering: "open", version: 2 },
  categories: [
    { id: "main", name_ja: "料理" },
    { id: "drink", name_ja: "飲み物" },
  ],
  items: [
    {
      id: "a",
      category_id: "main",
      name_ja: "唐揚げ",
      price: 600,
      available: true,
      version: 3,
    },
    {
      id: "b",
      category_id: "drink",
      name_ja: "お茶",
      price: 200,
      available: false,
      version: 1,
    },
  ],
  ...overrides,
});
const confirm = async (label) => {
  const button = showAlert.mock.calls.at(-1)[2].find((b) => b.text === label);
  await act(async () => button.onPress());
};
beforeEach(() => {
  jest.clearAllMocks();
  getStaffMenu.mockResolvedValue(menu());
  useNetworkStatus.mockReturnValue({ isOnline: true });
});
test("lists published items with category, price and state, and filters them", async () => {
  const screen = await render(<StaffMenuManager />);
  expect(await screen.findByText("テスト店：注文受付中")).toBeTruthy();
  expect(screen.getByText("公開中の商品2件のうち2件を表示")).toBeTruthy();
  expect(screen.getAllByText("販売中").length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole("button", { name: "売り切れ" }));
  expect(screen.getByText("公開中の商品2件のうち1件を表示")).toBeTruthy();
  expect(screen.queryByText("唐揚げ")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "状態：すべて" }));
  await fireEvent.press(screen.getByRole("button", { name: "料理" }));
  expect(screen.queryByText("お茶")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "カテゴリ：すべて" })
  );
  await fireEvent.changeText(screen.getByLabelText("商品名で検索"), "お茶");
  expect(screen.queryByText("唐揚げ")).toBeNull();
  expect(screen.getByText("お茶")).toBeTruthy();
});
test("marking sold out asks first and sends the displayed version", async () => {
  setMenuItemAvailability.mockResolvedValue({
    success: true,
    available: false,
    version: 4,
  });
  const screen = await render(<StaffMenuManager />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "唐揚げを売り切れにする" })
  );
  expect(showAlert.mock.calls[0][1]).toBe("「唐揚げ」を売り切れにしますか？");
  expect(setMenuItemAvailability).not.toHaveBeenCalled();
  await confirm("変更する");
  expect(setMenuItemAvailability).toHaveBeenCalledWith({
    itemId: "a",
    available: false,
    expectedVersion: 3,
    operationId: expect.any(String),
  });
  expect(screen.getByText("売り切れにしました。")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "唐揚げを販売を再開する" })
  ).toBeTruthy();
});
test("a conflict reloads the current state instead of overwriting it", async () => {
  setMenuItemAvailability.mockRejectedValue(
    Object.assign(new Error("changed"), { code: "functions/aborted" })
  );
  const screen = await render(<StaffMenuManager />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "唐揚げを売り切れにする" })
  );
  getStaffMenu.mockResolvedValue(
    menu({
      items: [
        { ...menu().items[0], available: false, version: 4 },
        menu().items[1],
      ],
    })
  );
  await confirm("変更する");
  await waitFor(() => expect(getStaffMenu).toHaveBeenCalledTimes(2));
  expect(screen.getByText(/別のスタッフが変更しました/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "唐揚げを販売を再開する" })
  ).toBeTruthy();
});
test("pausing orders explains the store-wide effect", async () => {
  setOrderingAvailability.mockResolvedValue({
    success: true,
    ordering: "paused",
    version: 3,
  });
  const screen = await render(<StaffMenuManager />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "注文受付を停止する" })
  );
  expect(showAlert.mock.calls[0][1]).toContain("店舗全体");
  await confirm("停止する");
  expect(setOrderingAvailability).toHaveBeenCalledWith({
    enabled: false,
    expectedVersion: 2,
    operationId: expect.any(String),
  });
  expect(screen.getByText("テスト店：注文受付停止中")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "注文受付を再開する" })
  ).toBeTruthy();
});
test("offline staff cannot change anything", async () => {
  useNetworkStatus.mockReturnValue({ isOnline: false });
  const screen = await render(<StaffMenuManager />);
  expect(
    await screen.findByText("オフラインのため変更できません。")
  ).toBeTruthy();
  const button = screen.getByRole("button", { name: "唐揚げを売り切れにする" });
  expect(button.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(button);
  expect(showAlert).not.toHaveBeenCalled();
});
test("a failed first load offers a retry", async () => {
  getStaffMenu.mockRejectedValueOnce(new Error("offline"));
  const screen = await render(<StaffMenuManager />);
  expect(
    await screen.findByText(
      "メニューを取得できません。接続を確認して「更新」を押してください。"
    )
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "更新" }));
  expect(await screen.findByText("テスト店：注文受付中")).toBeTruthy();
});
test("only editors see editing and translation controls", async () => {
  const screen = await render(<StaffMenuManager restaurantId="rest-test" />);
  await screen.findByText("テスト店：注文受付中");
  expect(screen.queryByRole("button", { name: "唐揚げを編集" })).toBeNull();
  expect(screen.queryByRole("button", { name: "翻訳を更新" })).toBeNull();
});
test("an editor opens the item editor and regenerates both languages", async () => {
  batchTranslateMenu.mockResolvedValue({ count: 2 });
  const screen = await render(
    <StaffMenuManager restaurantId="rest-test" canEditMenu />
  );
  await fireEvent.press(
    await screen.findByRole("button", { name: "翻訳を更新" })
  );
  await confirm("更新する");
  expect(batchTranslateMenu.mock.calls).toEqual([
    ["rest-test", "en", { generateBothModes: true }],
    ["rest-test", "zh", { generateBothModes: true }],
  ]);
  expect(screen.getByText("英語・中国語の翻訳を更新しました。")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "唐揚げを編集" }));
  expect(await screen.findByText("商品情報の編集：唐揚げ")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "一覧に戻る" }));
  expect(await screen.findByText("テスト店：注文受付中")).toBeTruthy();
});
