// Shared by the callable input contract and the customer quantity controls.
// MAX_ORDER_QUANTITY is per line; MAX_ORDER_TOTAL_QUANTITY is the sum of all
// lines of one order (docs/order_api.md).
module.exports = {
  MIN_ORDER_QUANTITY: 1,
  MAX_ORDER_QUANTITY: 99,
  MAX_ORDER_TOTAL_QUANTITY: 100,
};
