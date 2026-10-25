// 新着注文の通知音・振動・タブのタイトル（Web）。
// ブラウザは利用者の操作があるまで音を出せないため、音はスタッフが
// ボタンを押したときに有効にする。ネイティブ版では音と振動を使わない。
import { Platform } from "react-native";

let audio = null;
let baseTitle = null;

// Call from a press handler. Returns false where sound is unavailable.
export const enableAlertSound = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    audio = audio || new Context();
    audio.resume?.();
    return true;
  } catch {
    return false;
  }
};

export const disableAlertSound = () => {
  audio?.close?.();
  audio = null;
};

export const playNewOrderAlert = () => {
  if (audio) {
    try {
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.frequency.value = 880;
      volume.gain.value = 0.2;
      tone.connect(volume).connect(audio.destination);
      tone.start();
      tone.stop(audio.currentTime + 0.25);
    } catch {
      // A failed beep must not stop the order list; the banner still shows.
    }
  }
  if (Platform.OS === "web" && typeof navigator !== "undefined")
    navigator.vibrate?.(200);
};

// Shows "(3) " before the tab title while new orders are unchecked.
export const showTitleBadge = (count) => {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (baseTitle === null) baseTitle = document.title;
  document.title = count ? `(${count}) ${baseTitle}` : baseTitle;
};
