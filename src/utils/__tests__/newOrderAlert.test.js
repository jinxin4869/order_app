jest.mock("react-native", () => ({ Platform: { OS: "web" } }));
const load = () => {
  let alerts;
  jest.isolateModules(() => {
    alerts = require("../newOrderAlert");
  });
  return alerts;
};
afterEach(() => {
  delete global.window;
  delete global.document;
});
test("the tab title counts unchecked orders and is restored", () => {
  global.document = { title: "注文受付" };
  const { showTitleBadge } = load();
  showTitleBadge(3);
  expect(document.title).toBe("(3) 注文受付");
  showTitleBadge(0);
  expect(document.title).toBe("注文受付");
});
test("sound is unavailable without Web Audio", () => {
  global.window = {};
  expect(load().enableAlertSound()).toBe(false);
});
test("an enabled sound beeps, and the device vibrates where it can", () => {
  const tone = {
    frequency: {},
    connect: jest.fn((n) => n),
    start: jest.fn(),
    stop: jest.fn(),
  };
  const volume = { gain: {}, connect: jest.fn() };
  const context = {
    currentTime: 1,
    destination: {},
    resume: jest.fn(),
    close: jest.fn(),
    createOscillator: () => tone,
    createGain: () => volume,
  };
  // `new AudioContext()` returns this object.
  global.window = {
    AudioContext: function AudioContext() {
      return context;
    },
  };
  const vibrate = jest.fn();
  Object.defineProperty(global, "navigator", {
    value: { vibrate },
    configurable: true,
  });
  tone.connect.mockReturnValue(volume);
  const alerts = load();
  expect(alerts.enableAlertSound()).toBe(true);
  alerts.playNewOrderAlert();
  expect(tone.start).toHaveBeenCalled();
  expect(tone.stop).toHaveBeenCalledWith(1.25);
  expect(vibrate).toHaveBeenCalledWith(200);
  alerts.disableAlertSound();
  tone.start.mockClear();
  alerts.playNewOrderAlert();
  expect(tone.start).not.toHaveBeenCalled();
});
