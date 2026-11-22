// The one place that turns menu prices into what the customer pays. The
// server, the customer's cart and the staff correction all use it, so change
// the rule (rate, rounding, order of summing) here and nowhere else.
//
// Menu prices are stored tax-exclusive. Customers see tax-included prices,
// and an order's total is the sum of those, so the prices on screen always
// add up to the total. Dine-in rate only; reduced rates are not handled.
const TAX_PERCENT = 10;

// Tax-included price of `quantity` units: the unit price is rounded down to
// the yen first, then multiplied.
const taxIncluded = (price, quantity = 1) =>
  Math.floor((price * (100 + TAX_PERCENT)) / 100) * quantity;

// subtotal: tax-exclusive sum. total: sum of the tax-included lines, the
// amount to pay. tax: the difference between the two.
const totalsOf = (items) => {
  let subtotal = 0;
  let total = 0;
  for (const { price, quantity } of items) {
    subtotal += price * quantity;
    total += taxIncluded(price, quantity);
  }
  return { subtotal, tax: total - subtotal, total };
};

module.exports = { taxIncluded, totalsOf };
