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
  render(<OrderEntryScreen navigation={navigation} route={{ params }} />);
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
  const { getByRole } = render(
    <OrderEntryScreen
      navigation={{ reset: jest.fn() }}
      route={{ params: {} }}
    />
  );
  await waitFor(() => expect(getByRole("alert")).toBeTruthy());
  expect(validateQRCode).not.toHaveBeenCalled();
});
test("stopped tables are shown without starting a session", async () => {
  validateQRCode.mockResolvedValue({ valid: false, error: "Stopped table" });
  const navigation = { reset: jest.fn() };
  const { getByText } = render(
    <OrderEntryScreen navigation={navigation} route={{ params }} />
  );
  await waitFor(() => expect(getByText("Stopped table")).toBeTruthy());
  expect(navigation.reset).not.toHaveBeenCalled();
});
test("connection failures can be retried", async () => {
  validateQRCode
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ valid: false, error: "Retry reached server" });
  const { getByText } = render(
    <OrderEntryScreen navigation={{ reset: jest.fn() }} route={{ params }} />
  );
  await waitFor(() => expect(getByText(/Connection failed/)).toBeTruthy());
  fireEvent.press(getByText("再試行 / Retry / 重试"));
  await waitFor(() => expect(getByText("Retry reached server")).toBeTruthy());
  expect(validateQRCode).toHaveBeenCalledTimes(2);
});
