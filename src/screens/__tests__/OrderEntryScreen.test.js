jest.mock("../../services/api", () => ({ validateQRCode: jest.fn() }));
import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import OrderEntryScreen from "../OrderEntryScreen";
import { validateQRCode } from "../../services/api";
const params = { restaurant: "rest-test", table: "table-test" };
beforeEach(() => jest.clearAllMocks());
test("validates the URL and starts the session without camera access", async () => {
  validateQRCode.mockResolvedValue({
    valid: true,
    restaurant: { name: "Test" },
    table: { table_number: "1" },
  });
  const navigation = { reset: jest.fn() };
  await render(<OrderEntryScreen navigation={navigation} route={{ params }} />);
  await waitFor(() =>
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: "LanguageSelect",
          params: {
            restaurantId: "rest-test",
            tableId: "table-test",
            restaurant: { name: "Test" },
            table: { table_number: "1" },
          },
        },
      ],
    })
  );
});
test("invalid URLs do not call the server", async () => {
  const { getByRole } = await render(
    <OrderEntryScreen
      navigation={{ reset: jest.fn() }}
      route={{ params: {} }}
    />
  );
  await waitFor(() => expect(getByRole("alert")).toBeTruthy());
  expect(validateQRCode).not.toHaveBeenCalled();
});
// The language is chosen after this screen, so refusals show all three.
test.each([
  [
    "table_unavailable",
    "このテーブルは現在利用できません。スタッフにお声がけください。 / This table is not available now. Please ask a staff member. / 该餐桌目前无法使用。请联系店员。",
  ],
  [
    "restaurant_inactive",
    "この店舗は現在、営業していません。スタッフにお声がけください。 / This restaurant is not open now. Please ask a staff member. / 该店铺目前未营业。请联系店员。",
  ],
  [
    "restaurant_not_found",
    "この店舗が見つかりません。スタッフにお声がけください。 / This restaurant could not be found. Please ask a staff member. / 找不到该店铺。请联系店员。",
  ],
  [
    "table_not_found",
    "このテーブルが見つかりません。スタッフにお声がけください。 / This table could not be found. Please ask a staff member. / 找不到该餐桌。请联系店员。",
  ],
  [
    "invalid_format",
    "QRコードを読み取れませんでした。テーブルのQRコードを読み取り直してください。 / This QR code could not be read. Please scan the QR code on your table again. / 无法识别此二维码。请重新扫描桌上的二维码。",
  ],
  // An older server sends only its Japanese text.
  [
    undefined,
    "このテーブルは利用できません。スタッフにお声がけください。 / This table cannot be used. Please ask a staff member. / 该餐桌无法使用。请联系店员。",
  ],
])(
  "a refused table (%s) is explained in three languages without starting a session",
  async (reason, message) => {
    validateQRCode.mockResolvedValue({
      valid: false,
      error: "このテーブルは現在利用できません。",
      reason,
    });
    const navigation = { reset: jest.fn() };
    const { getByText, queryByText } = await render(
      <OrderEntryScreen navigation={navigation} route={{ params }} />
    );
    await waitFor(() => expect(getByText(message)).toBeTruthy());
    expect(queryByText("このテーブルは現在利用できません。")).toBeNull();
    expect(navigation.reset).not.toHaveBeenCalled();
  }
);
test("connection failures can be retried", async () => {
  validateQRCode
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ valid: false, reason: "check_failed" });
  const { getByText } = await render(
    <OrderEntryScreen navigation={{ reset: jest.fn() }} route={{ params }} />
  );
  await waitFor(() => expect(getByText(/Connection failed/)).toBeTruthy());
  await fireEvent.press(getByText("再試行 / Retry / 重试"));
  await waitFor(() =>
    expect(getByText(/Your table could not be checked/)).toBeTruthy()
  );
  expect(validateQRCode).toHaveBeenCalledTimes(2);
});
test("a QR token is validated and carried with the table", async () => {
  validateQRCode.mockResolvedValue({
    valid: true,
    restaurant: { name: "Test" },
    table: { table_number: "1" },
  });
  const navigation = { reset: jest.fn() };
  await render(
    <OrderEntryScreen
      navigation={navigation}
      route={{ params: { ...params, token: "abcdefghijklmnop_-12" } }}
    />
  );
  await waitFor(() => expect(navigation.reset).toHaveBeenCalled());
  expect(validateQRCode).toHaveBeenCalledWith(
    "rest-test/table-test/abcdefghijklmnop_-12"
  );
  expect(navigation.reset.mock.calls[0][0].routes[0].params.table).toEqual({
    table_number: "1",
    token: "abcdefghijklmnop_-12",
  });
});
test("a malformed token makes the link invalid without calling the server", async () => {
  const screen = await render(
    <OrderEntryScreen
      navigation={{ reset: jest.fn() }}
      route={{ params: { ...params, token: "bad" } }}
    />
  );
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(validateQRCode).not.toHaveBeenCalled();
});
