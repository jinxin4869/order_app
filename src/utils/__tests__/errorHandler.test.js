jest.mock("@sentry/react-native", () => ({ captureException: jest.fn() }));
import { isNetworkError, withRetry } from "../errorHandler";

test("Firebase callable unavailability is retryable, but permissions and price changes are not", () => {
  expect(isNetworkError({ code: "functions/unavailable" })).toBe(true);
  expect(isNetworkError({ code: "unavailable" })).toBe(true);
  expect(isNetworkError({ code: "functions/permission-denied" })).toBe(false);
  expect(isNetworkError({ code: "functions/failed-precondition" })).toBe(false);
});

test("the real retry helper retries Firebase callable unavailability", async () => {
  const fn = jest.fn().mockRejectedValueOnce({ code: "functions/unavailable", message: "Service unavailable" }).mockResolvedValueOnce("ok");
  expect(await withRetry(fn, 2, 1)).toBe("ok");
  expect(fn).toHaveBeenCalledTimes(2);
});
