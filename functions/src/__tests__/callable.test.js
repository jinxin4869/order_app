jest.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return {
    HttpsError,
    onCall: (options, handler) => Object.assign(handler, { options }),
  };
});
const { onAppCall } = require("../utils/callable");

let handler;
let callable;
beforeEach(() => {
  handler = jest.fn(async () => "ok");
  callable = onAppCall({ memory: "512MiB" }, handler);
});
afterEach(() => {
  delete process.env.ENFORCE_APP_CHECK;
});

test("every callable runs in Tokyo and keeps its own options", () => {
  expect(callable.options).toEqual({
    region: "asia-northeast1",
    memory: "512MiB",
  });
});
test("requests without App Check pass while enforcement is off", async () => {
  expect(await callable({ data: {} })).toBe("ok");
});
test.each([undefined, "false", "1"])(
  "only the exact value true enables enforcement (%s)",
  async (value) => {
    if (value !== undefined) process.env.ENFORCE_APP_CHECK = value;
    expect(await callable({ data: {} })).toBe("ok");
  }
);
test("enforcement rejects a missing App Check token before the handler", async () => {
  process.env.ENFORCE_APP_CHECK = "true";
  await expect(callable({ data: {} })).rejects.toMatchObject({
    code: "failed-precondition",
    details: { reason: "app_check_required" },
  });
  expect(handler).not.toHaveBeenCalled();
});
test("enforcement accepts a verified App Check token", async () => {
  process.env.ENFORCE_APP_CHECK = "true";
  const request = { data: {}, app: { appId: "synthetic-app" } };
  expect(await callable(request)).toBe("ok");
  expect(handler).toHaveBeenCalledWith(request);
});
