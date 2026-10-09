const { businessDay } = require("../utils/businessDay");
test.each([
  ["2026-10-08T14:59:59.999Z", "20261008"],
  ["2026-10-08T15:00:00.000Z", "20261009"],
  ["2026-12-31T15:00:00.000Z", "20270101"],
])("%s uses a midnight JST business day", (instant, expected) => {
  expect(businessDay(new Date(instant))).toBe(expected);
});
