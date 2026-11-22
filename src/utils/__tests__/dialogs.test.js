import { Alert, Platform } from "react-native";
import { showAlert } from "../dialogs";

afterEach(() => jest.restoreAllMocks());
test("web confirmation invokes only the selected action", () => {
  jest.replaceProperty(Platform, "OS", "web");
  window.confirm = jest.fn().mockReturnValue(true);
  const confirm = jest.fn();
  const cancel = jest.fn();
  showAlert("Confirm", "Place order?", [
    { text: "Cancel", style: "cancel", onPress: cancel },
    { text: "Order", onPress: confirm },
  ]);
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
  window.confirm.mockReturnValue(false);
  showAlert("Confirm", "Place order?", [
    { text: "Cancel", style: "cancel", onPress: cancel },
    { text: "Order", onPress: confirm },
  ]);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(confirm).toHaveBeenCalledTimes(1);
});
test("web confirmation says which browser button runs the action", () => {
  // The browser shows its own "OK" / "キャンセル", so "キャンセル" in the
  // question must not be mistaken for the button that cancels the order.
  jest.replaceProperty(Platform, "OS", "web");
  window.confirm = jest.fn().mockReturnValue(false);
  showAlert(
    "注文の状態を変更",
    "20261009-001を「キャンセル」に変更しますか？",
    [
      { text: "戻る", style: "cancel" },
      { text: "変更する", onPress: jest.fn() },
    ]
  );
  expect(window.confirm).toHaveBeenCalledWith(
    "注文の状態を変更\n\n20261009-001を「キャンセル」に変更しますか？\n\nOK → 変更する"
  );
});
test("web error acknowledgement allows QR scanning to resume", () => {
  jest.replaceProperty(Platform, "OS", "web");
  window.alert = jest.fn();
  const resume = jest.fn();
  showAlert("Error", "Invalid QR", [{ text: "OK", onPress: resume }]);
  expect(window.alert).toHaveBeenCalledWith("Error\n\nInvalid QR");
  expect(resume).toHaveBeenCalledTimes(1);
});
test("native platforms keep their native alert", () => {
  jest.replaceProperty(Platform, "OS", "ios");
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  showAlert("Error", "Connection failed");
  expect(Alert.alert).toHaveBeenCalledWith("Error", "Connection failed");
  const buttons = [
    { text: "戻る", style: "cancel" },
    { text: "変更する", onPress: jest.fn() },
  ];
  showAlert("注文の状態を変更", "変更しますか？", buttons);
  expect(Alert.alert).toHaveBeenLastCalledWith(
    "注文の状態を変更",
    "変更しますか？",
    buttons
  );
});
