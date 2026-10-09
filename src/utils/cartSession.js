import { parseOrderLink } from "./orderLinks";
export const cartSessionKey = (restaurantId, tableId) => {
  const session = parseOrderLink(`${restaurantId || ""}/${tableId || ""}`);
  return session ? `${session.restaurantId}/${session.tableId}` : null;
};
export const syncCartRoute = (route, cart) => {
  if (!route) return;
  const { restaurantId, tableId } = route.params || {};
  if (restaurantId && tableId) cart.setSession(restaurantId, tableId);
  else if (["QRScanner", "OrderEntry"].includes(route.name)) cart.endSession();
};
