import { Alert, Platform } from "react-native";

// Preserve native alerts and use real browser dialogs on react-native-web.
export const showAlert = (...args) => {
  if (Platform.OS !== "web") return Alert.alert(...args);
  const [title, message = "", buttons = []] = args;
  const text = [title, message].filter(Boolean).join("\n\n");
  const actions = buttons.filter((button) => button.style !== "cancel");
  const cancel = buttons.find((button) => button.style === "cancel");
  if (cancel && actions.length) {
    // The browser labels the buttons itself (e.g. "OK" / "キャンセル"), so say
    // which one runs the action: "キャンセル" may also be the action's word.
    if (window.confirm(`${text}\n\nOK → ${actions[0].text}`))
      actions[0].onPress?.();
    else cancel.onPress?.();
  } else {
    window.alert(text);
    actions[0]?.onPress?.();
  }
};
