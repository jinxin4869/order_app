jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  init: jest.fn(),
}));
jest.mock("expo-constants", () => ({
  expoConfig: { extra: { sentryDsn: "https://key@o0.ingest.sentry.io/0" } },
}));
import * as Sentry from "@sentry/react-native";
import { deleteApp, getApps, initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
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

// The errors below are thrown by the installed Functions SDK itself, so a
// change in how the SDK reports them fails here instead of in the store.
describe("errors thrown by the real Functions SDK", () => {
  const callable = (options) =>
    httpsCallable(
      getFunctions(initializeApp({ projectId: "demo-order-app" }, "retry")),
      "getMenuWithTranslation",
      options
    );
  const connectionLost = () => Promise.reject(new TypeError("Failed to fetch"));
  const responds = (status, body) => () =>
    Promise.resolve({ status, json: async () => body });
  const serverError = (status, code, details) =>
    responds(status, {
      error: { status: code, message: "合成の応答", details },
    });
  const realFetch = global.fetch;
  const failure = async (fetchImpl, options) => {
    global.fetch = jest.fn(fetchImpl);
    return callable(options)({}).then(
      () => {
        throw new Error("the call was expected to fail");
      },
      (error) => error
    );
  };
  afterEach(async () => {
    global.fetch = realFetch;
    await Promise.all(getApps().map(deleteApp));
  });

  test("a lost connection is retryable; the SDK reports it as internal with status 0", async () => {
    const error = await failure(connectionLost);
    expect(error).toMatchObject({
      code: "functions/internal",
      message: "internal [0]",
    });
    expect(isNetworkError(error)).toBe(true);
    expect(isNetworkError(await failure(responds(503, null)))).toBe(true);
  });

  test("answers from the server, and the SDK's own timeout, are not retryable", async () => {
    const internal = await failure(serverError(500, "INTERNAL"));
    expect(internal.code).toBe("functions/internal");
    expect(isNetworkError(internal)).toBe(false);
    // A 500 without a readable body, e.g. from the platform in front of the function.
    expect(isNetworkError(await failure(responds(500, null)))).toBe(false);
    expect(
      isNetworkError(await failure(serverError(403, "PERMISSION_DENIED")))
    ).toBe(false);
    expect(
      isNetworkError(
        await failure(
          serverError(400, "FAILED_PRECONDITION", { reason: "price_changed" })
        )
      )
    ).toBe(false);
    const timedOut = await failure(() => new Promise(() => {}), { timeout: 5 });
    expect(timedOut.code).toBe("functions/deadline-exceeded");
    expect(isNetworkError(timedOut)).toBe(false);
  });

  test("the retry helper sends again after a lost connection, and only then", async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(connectionLost)
      .mockImplementationOnce(responds(200, { result: "ok" }));
    const call = callable();
    expect(await withRetry(() => call({}), 2, 1)).toEqual({ data: "ok" });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    for (const [fetchImpl, options] of [
      [serverError(500, "INTERNAL")],
      [serverError(400, "FAILED_PRECONDITION", { reason: "price_changed" })],
      [() => new Promise(() => {}), { timeout: 5 }],
    ]) {
      global.fetch = jest.fn(fetchImpl);
      const once = callable(options);
      await expect(withRetry(() => once({}), 3, 1)).rejects.toMatchObject({
        name: "FirebaseError",
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }
  });
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
