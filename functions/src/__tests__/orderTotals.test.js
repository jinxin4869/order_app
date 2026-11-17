const { taxIncluded, totalsOf } = require("../utils/orderTotals");

test.each([
  [0, 0],
  [1, 1], // 1.1
  [9, 9], // 9.9
  [10, 11],
  [95, 104], // 104.5
  [99, 108], // 108.9
  [100, 110],
  [333, 366], // 366.3
  [1000, 1100],
  [1_000_000, 1_100_000],
])("a unit of ¥%i before tax is ¥%i with tax, rounded down", (price, paid) =>
  expect(taxIncluded(price)).toBe(paid)
);

test("a line is the tax-included unit price times the quantity", () => {
  expect(taxIncluded(95, 2)).toBe(208);
  expect(taxIncluded(95, 0)).toBe(0);
  expect(taxIncluded(333, 99)).toBe(36234);
});

test("the total is the sum of the tax-included lines, not tax on the subtotal", () => {
  // Tax on the ¥190 subtotal would give ¥209; the prices shown add up to ¥208.
  expect(totalsOf([{ price: 95, quantity: 2 }])).toEqual({
    subtotal: 190,
    tax: 18,
    total: 208,
  });
  expect(
    totalsOf([
      { price: 95, quantity: 1 },
      { price: 95, quantity: 1 },
      { price: 1000, quantity: 3 },
    ])
  ).toEqual({ subtotal: 3190, tax: 318, total: 3508 });
});

test("empty orders, free items and cancelled lines add nothing", () => {
  expect(totalsOf([])).toEqual({ subtotal: 0, tax: 0, total: 0 });
  expect(
    totalsOf([
      { price: 0, quantity: 5 },
      { price: 980, quantity: 0 },
    ])
  ).toEqual({ subtotal: 0, tax: 0, total: 0 });
});

test("every amount stays a whole number of yen", () => {
  for (let price = 0; price <= 2000; price++) {
    const { subtotal, tax, total } = totalsOf([{ price, quantity: 3 }]);
    expect(Number.isInteger(total)).toBe(true);
    expect(subtotal + tax).toBe(total);
    expect(total).toBe(taxIncluded(price) * 3);
    // Rounding never charges more than 10%, and never loses a whole yen.
    expect(taxIncluded(price)).toBeLessThanOrEqual(price * 1.1 + 1e-9);
    expect(taxIncluded(price)).toBeGreaterThan(price * 1.1 - 1);
  }
});
