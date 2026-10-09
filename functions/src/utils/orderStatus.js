const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};
const VALID_STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: ["completed"],
  completed: [],
  cancelled: [],
};
const STATUS_LABELS = {
  pending: "未受付",
  confirmed: "受付済み",
  preparing: "調理中",
  ready: "提供待ち",
  served: "提供済み",
  completed: "対応完了",
  cancelled: "キャンセル",
};
module.exports = { ORDER_STATUS, VALID_STATUS_TRANSITIONS, STATUS_LABELS };
