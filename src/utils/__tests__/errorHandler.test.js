jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  init: jest.fn(),
}));
jest.mock("expo-constants", () => ({
  expoConfig: { extra: { sentryDsn: "https://key@o0.ingest.sentry.io/0" } },
}));
import * as Sentry from "@sentry/react-native";
import { isNetworkError, withRetry, initializeSentry } from "../errorHandler";

test("Firebase callable unavailability is retryable, but permissions and price changes are not", () => {
  expect(isNetworkError({ code: "functions/unavailable" })).toBe(true);
  expect(isNetworkError({ code: "unavailable" })).toBe(true);
  expect(isNetworkError({ code: "functions/permission-denied" })).toBe(false);
  expect(isNetworkError({ code: "functions/failed-precondition" })).toBe(false);
});

test("the real retry helper retries Firebase callable unavailability", async () => {
  const fn = jest
    .fn()
    .mockRejectedValueOnce({
      code: "functions/unavailable",
      message: "Service unavailable",
    })
    .mockResolvedValueOnce("ok");
  expect(await withRetry(fn, 2, 1)).toBe("ok");
  expect(fn).toHaveBeenCalledTimes(2);
});

// Last: this initializes the (mocked) SDK for the rest of the file.
test("table tokens in page URLs are blanked before events and transactions are sent", () => {
  const url = (token) =>
    `https://example.invalid/order?restaurant=rest-test&table=table-test&token=${token}`;
  const event = () => ({
    request: {
      url: url("synthetic-table-token-1"),
      headers: { Referer: url("synthetic-table-token-1") + "#top" },
    },
    breadcrumbs: [
      {
        category: "navigation",
        data: {
          from: "/order?token=synthetic-table-token-1&table=table-test",
          to: "/staff",
        },
      },
    ],
    spans: [{ data: { "url.full": url("synthetic-table-token-1") } }],
    extra: { function: "createOrder", params: { itemCount: 2 } },
  });
  global.__DEV__ = false;
  try {
    initializeSentry();
    const { beforeSend, beforeSendTransaction } = Sentry.init.mock.calls[0][0];
    for (const sent of [
      beforeSend(event(), {}),
      beforeSendTransaction(event(), {}),
    ]) {
      expect(JSON.stringify(sent)).not.toContain("synthetic-table-token-1");
      expect(sent.request.url).toBe(url("[redacted]"));
      expect(sent.request.headers.Referer).toBe(url("[redacted]") + "#top");
      expect(sent.breadcrumbs[0].data).toEqual({
        from: "/order?token=[redacted]&table=table-test",
        to: "/staff",
      });
      expect(sent.extra).toEqual(event().extra);
    }
  } finally {
    global.__DEV__ = true;
  }
});
