import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import MenuItemEditor from "../MenuItemEditor";
import {
  getEditableMenuItem,
  saveMenuItemDraft,
  publishMenuItemDraft,
  discardMenuItemDraft,
} from "../../services/api";
import { showAlert } from "../../utils/dialogs";
jest.mock("../../services/api", () => ({
  getEditableMenuItem: jest.fn(),
  saveMenuItemDraft: jest.fn(),
  publishMenuItemDraft: jest.fn(),
  discardMenuItemDraft: jest.fn(),
}));
jest.mock("../../utils/dialogs", () => ({ showAlert: jest.fn() }));
const live = {
  id: "item-1",
  name_ja: "唐揚げ",
  description_ja: "定番",
  price: 600,
  image_url: null,
  allergens: ["wheat"],
  version: 3,
};
const confirm = async (label) => {
  const button = showAlert.mock.calls.at(-1)[2].find((b) => b.text === label);
  await act(async () => button.onPress());
};
beforeEach(() => {
  jest.clearAllMocks();
  getEditableMenuItem.mockResolvedValue({ item: live, draft: null });
});
test("saving a draft sends the edited fields with the version shown", async () => {
  saveMenuItemDraft.mockResolvedValue({ success: true });
  const screen = await render(
    <MenuItemEditor itemId="item-1" onClose={jest.fn()} />
  );
  await fireEvent.changeText(
    await screen.findByLabelText("商品名（日本語・必須）"),
    "特製唐揚げ"
  );
  await fireEvent.changeText(
    screen.getByLabelText("価格（税抜・円）"),
    "７00円"
  );
  expect(screen.getByText("¥700")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "下書きを公開" }).props
      .accessibilityState.disabled
  ).toBe(true);
  getEditableMenuItem.mockResolvedValue({
    item: live,
    draft: { ...live, name_ja: "特製唐揚げ", price: 700, base_version: 3 },
  });
  await fireEvent.press(screen.getByRole("button", { name: "下書きを保存" }));
  expect(saveMenuItemDraft).toHaveBeenCalledWith({
    itemId: "item-1",
    expectedVersion: 3,
    draft: {
      name_ja: "特製唐揚げ",
      description_ja: "定番",
      price: 700,
      image_url: "",
    },
    operationId: expect.any(String),
  });
  expect(
    await screen.findByText(
      "下書きを保存しました。お客様の画面はまだ変わりません。"
    )
  ).toBeTruthy();
  expect(screen.getByText(/アレルゲン：wheat/)).toBeTruthy();
});
test("publishing lists the changes and asks to update translations after a rename", async () => {
  getEditableMenuItem.mockResolvedValue({
    item: live,
    draft: { ...live, name_ja: "特製唐揚げ", price: 700, base_version: 3 },
  });
  publishMenuItemDraft.mockResolvedValue({
    success: true,
    version: 4,
    translationsOutdated: true,
  });
  const screen = await render(
    <MenuItemEditor itemId="item-1" onClose={jest.fn()} />
  );
  await fireEvent.press(
    await screen.findByRole("button", { name: "下書きを公開" })
  );
  const text = showAlert.mock.calls[0][1];
  expect(text).toContain("商品名：唐揚げ → 特製唐揚げ");
  expect(text).toContain("価格：¥600 → ¥700");
  expect(text).toContain("翻訳を更新するまで");
  await confirm("公開する");
  expect(publishMenuItemDraft).toHaveBeenCalledWith({
    itemId: "item-1",
    expectedVersion: 3,
    operationId: expect.any(String),
  });
  expect(
    await screen.findByText(/「翻訳を更新」で英語・中国語の翻訳を更新/)
  ).toBeTruthy();
});
test("a refused input explains why, and a draft can be discarded", async () => {
  saveMenuItemDraft.mockRejectedValue(
    Object.assign(
      new Error("画像URLはhttpsで始まる500文字以下のURLにしてください"),
      {
        code: "functions/invalid-argument",
      }
    )
  );
  getEditableMenuItem.mockResolvedValue({
    item: live,
    draft: { ...live, base_version: 3 },
  });
  discardMenuItemDraft.mockResolvedValue({ success: true });
  const screen = await render(
    <MenuItemEditor itemId="item-1" onClose={jest.fn()} />
  );
  await fireEvent.press(
    await screen.findByRole("button", { name: "下書きを保存" })
  );
  expect(await screen.findByText(/httpsで始まる/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "下書きを破棄" }));
  await confirm("破棄する");
  expect(discardMenuItemDraft).toHaveBeenCalledWith({ itemId: "item-1" });
});
test("without permission the editor says so", async () => {
  getEditableMenuItem.mockRejectedValue(
    Object.assign(new Error("x"), { code: "functions/permission-denied" })
  );
  const onClose = jest.fn();
  const screen = await render(
    <MenuItemEditor itemId="item-1" onClose={onClose} />
  );
  expect(
    await screen.findByText(/編集権限と接続を確認してください/)
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "一覧に戻る" }));
  expect(onClose).toHaveBeenCalledWith(false);
});
