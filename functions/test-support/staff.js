// Synthetic Auth records only; no default app, credentials or network access.
const staff = (restaurantId = "rest-test", role = "staff") => ({
  uid: "staff-test",
  token: {
    role,
    restaurantId,
    auth_time: Date.parse("2026-10-09T01:00:00Z") / 1000,
  },
});
const staffUser = (overrides = {}) => ({
  uid: "staff-test",
  disabled: false,
  tokensValidAfterTime: "2026-10-09T00:00:00Z",
  customClaims: { role: "staff", restaurantId: "rest-test" },
  ...overrides,
});
module.exports = { staff, staffUser };
