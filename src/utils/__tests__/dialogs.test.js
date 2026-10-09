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
});
