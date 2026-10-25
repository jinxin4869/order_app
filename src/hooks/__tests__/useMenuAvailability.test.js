import { renderHook, act } from "@testing-library/react-native";
import { useMenuAvailability, isSoldOut } from "../useMenuAvailability";
import { getMenuAvailability } from "../../services/api";
jest.mock("../../services/api", () => ({ getMenuAvailability: jest.fn() }));
jest.mock("../useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));
const listeners = {};
const navigation = {
  addListener: (type, handler) => {
    listeners[type] = handler;
    return () => delete listeners[type];
  },
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());
const flush = () => act(async () => {});
test("checks at once and every 15 seconds while the screen is in front", async () => {
  getMenuAvailability.mockResolvedValue({ ordering: "open", soldOut: ["a"] });
  const { result } = await renderHook(() =>
    useMenuAvailability("rest-test", navigation)
  );
  await flush();
  expect(getMenuAvailability).toHaveBeenCalledWith("rest-test");
  expect(result.current.ordering).toBe("open");
  expect(isSoldOut({ id: "a" }, result.current)).toBe(true);
  expect(isSoldOut({ id: "b", is_available: false }, result.current)).toBe(
    false
  );
  await act(async () => jest.advanceTimersByTime(15000));
  expect(getMenuAvailability).toHaveBeenCalledTimes(2);
  await act(async () => listeners.blur());
  await act(async () => jest.advanceTimersByTime(60000));
  expect(getMenuAvailability).toHaveBeenCalledTimes(2);
  await act(async () => listeners.focus());
  expect(getMenuAvailability).toHaveBeenCalledTimes(3);
});
test("before the first answer the loaded menu decides; a failure keeps the last state", async () => {
  let answer;
  getMenuAvailability.mockImplementationOnce(
    () => new Promise((resolve) => (answer = resolve))
  );
  const { result } = await renderHook(() =>
    useMenuAvailability("rest-test", navigation)
  );
  expect(isSoldOut({ id: "x", is_available: false }, result.current)).toBe(
    true
  );
  await act(async () => answer({ ordering: "paused", soldOut: [] }));
  expect(isSoldOut({ id: "x", is_available: false }, result.current)).toBe(
    false
  );
  getMenuAvailability.mockRejectedValueOnce(new Error("offline"));
  await act(async () => jest.advanceTimersByTime(15000));
  await flush();
  expect(result.current.failed).toBe(true);
  expect(result.current.ordering).toBe("paused");
  await act(async () => result.current.markSoldOut("x"));
  expect(isSoldOut({ id: "x" }, result.current)).toBe(true);
});
test("an answer that arrives after a newer request is ignored", async () => {
  let first;
  getMenuAvailability
    .mockImplementationOnce(() => new Promise((resolve) => (first = resolve)))
    .mockResolvedValueOnce({ ordering: "open", soldOut: [] });
  const { result } = await renderHook(() =>
    useMenuAvailability("rest-test", navigation)
  );
  await act(async () => result.current.refresh());
  await act(async () => first({ ordering: "paused", soldOut: ["late"] }));
  expect(result.current.ordering).toBe("open");
  expect(isSoldOut({ id: "late" }, result.current)).toBe(false);
});
