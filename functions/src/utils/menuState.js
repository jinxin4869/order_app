// 商品・店舗の販売と受付の状態。顧客API・注文・スタッフ操作で共有する。

// Shown to customers (on sale or sold out). Items saved before is_published
// existed stay visible only while on sale, so an old unavailable item is
// never newly exposed as "sold out".
const isPublished = (item) =>
  item.is_published === true ||
  (item.is_published == null && item.is_available === true);
const isOnSale = (item) => isPublished(item) && item.is_available === true;

// "open" unless staff paused new orders; a malformed value accepts nothing.
const orderingState = (restaurant) =>
  restaurant.ordering_enabled == null || restaurant.ordering_enabled === true
    ? "open"
    : restaurant.ordering_enabled === false
      ? "paused"
      : "invalid";

const versionOf = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value : 0;

module.exports = { isPublished, isOnSale, orderingState, versionOf };
