const { staff, staffUser } = require("../../test-support/staff");
const mockGetUser = jest.fn();
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ getUser: (...args) => mockGetUser(...args) }),
}));
jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));
const { requireStaff } = require("../utils/staffAuth");

beforeEach(() => {
  mockGetUser.mockReset().mockResolvedValue(staffUser());
});

test("valid staff is checked against current Auth state on every request", async () => {
  const request = { auth: staff() };
  await expect(requireStaff(request)).resolves.toBe("rest-test");
  mockGetUser.mockResolvedValueOnce(staffUser({ disabled: true }));
  await expect(requireStaff(request)).rejects.toMatchObject({
    code: "unauthenticated",
  });
  expect(mockGetUser).toHaveBeenCalledTimes(2);
  expect(mockGetUser).toHaveBeenCalledWith("staff-test");
});

test.each([
  [undefined, "unauthenticated"],
  [staff("rest-test", "customer"), "permission-denied"],
  [staff("../other-store"), "permission-denied"],
  [
    { ...staff(), token: { ...staff().token, auth_time: undefined } },
    "unauthenticated",
  ],
  [
    { ...staff(), token: { ...staff().token, auth_time: "1791507600" } },
    "unauthenticated",
  ],
  [
    { ...staff(), token: { ...staff().token, auth_time: NaN } },
    "unauthenticated",
  ],
])("invalid callers fail before an Auth lookup", async (auth, code) => {
  await expect(requireStaff({ auth })).rejects.toMatchObject({ code });
  expect(mockGetUser).not.toHaveBeenCalled();
});

test.each([
  { disabled: true },
  { tokensValidAfterTime: "2026-10-09T01:00:00Z" },
  { tokensValidAfterTime: "2026-10-09T01:00:01Z" },
])(
  "disabled or revoked sessions fail, including the cutoff second",
  async (change) => {
    mockGetUser.mockResolvedValueOnce(staffUser(change));
    await expect(requireStaff({ auth: staff() })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  }
);

test.each([
  { role: "staff", restaurantId: "other-store" },
  { role: "customer", restaurantId: "rest-test" },
  {},
])("current claims changes reject an old staff token", async (customClaims) => {
  mockGetUser.mockResolvedValueOnce(staffUser({ customClaims }));
  await expect(requireStaff({ auth: staff() })).rejects.toMatchObject({
    code: "permission-denied",
  });
});

test.each([
  { code: "auth/user-not-found", expected: "unauthenticated" },
  { code: "auth/internal-error", expected: "unavailable" },
  { code: "auth/insufficient-permission", expected: "unavailable" },
])(
  "lookup errors deny access without leaking provider errors",
  async ({ code, expected }) => {
    mockGetUser.mockRejectedValueOnce(
      Object.assign(new Error("private provider details"), { code })
    );
    await expect(requireStaff({ auth: staff() })).rejects.toMatchObject({
      code: expected,
    });
    mockGetUser.mockRejectedValueOnce(new Error("private provider details"));
    await expect(requireStaff({ auth: staff() })).rejects.not.toThrow(
      "private provider details"
    );
  }
);

test.each([
  { tokensValidAfterTime: undefined },
  { tokensValidAfterTime: "invalid" },
  { disabled: undefined },
  { uid: "another-user" },
])("unverifiable Auth records fail closed", async (change) => {
  mockGetUser.mockResolvedValueOnce(staffUser(change));
  await expect(requireStaff({ auth: staff() })).rejects.toMatchObject({
    code: "unavailable",
  });
});

test("reactivation and transfer require a fresh sign-in after the cutoff", async () => {
  mockGetUser.mockResolvedValue(
    staffUser({
      tokensValidAfterTime: "2026-10-09T01:00:01Z",
      customClaims: { role: "staff", restaurantId: "other-store" },
    })
  );
  await expect(requireStaff({ auth: staff() })).rejects.toMatchObject({
    code: "unauthenticated",
  });
  const fresh = staff("other-store");
  fresh.token.auth_time += 2;
  await expect(requireStaff({ auth: fresh })).resolves.toBe("other-store");
});
