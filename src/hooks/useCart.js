// カート管理用カスタムフック
import { useState, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MIN_ORDER_QUANTITY, MAX_ORDER_QUANTITY } from "../constants";
import { totalsOf } from "../utils/price";
import { createRequestId } from "../utils/requestId";
import { cartSessionKey } from "../utils/cartSession";
import { getOrderRequest } from "../services/api";

// The last order sent from this device whose result is not yet known. Only one
// is kept: starting another store or table discards it.
const PENDING_ORDER_KEY = "@qr_order_pending";
const PENDING_ORDER_TTL_MS = 3 * 60 * 60 * 1000;
// What the customer actually orders. The display language and translated
// names are left out so a language change does not turn a retry into a new order.
const orderContent = (orderData) =>
  JSON.stringify({
    restaurantId: orderData.restaurantId,
    tableId: orderData.tableId,
    customerNotes: orderData.customerNotes ?? null,
    items: orderData.items.map((item) => ({
      item_id: item.item_id,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes ?? null,
    })),
  });
const forgetPendingOrder = () =>
  AsyncStorage.removeItem(PENDING_ORDER_KEY).catch(() => {});
// The cart without the lines of an order the server already has.
const withoutOrdered = (cartItems, ordered) =>
  cartItems.flatMap((item) => {
    const sent = ordered.find(
      (line) =>
        line.item_id === item.id && (line.notes || "") === (item.notes || "")
    );
    const quantity = item.quantity - (sent?.quantity ?? 0);
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });

// The device's visit at one table: a random ID sent with each order so this
// device, and only it, can list them. It ends when staff clear the table (the
// server then reports it closed) or after the server's 12-hour limit.
const VISIT_KEY = "@qr_order_visit";
const VISIT_TTL_MS = 12 * 60 * 60 * 1000;
const newVisit = (sessionKey) => {
  const visit = {
    sessionKey,
    visitId: createRequestId(),
    startedAt: Date.now(),
  };
  AsyncStorage.setItem(VISIT_KEY, JSON.stringify(visit)).catch(() => {});
  return visit;
};
const loadVisit = async (sessionKey) => {
  try {
    const visit = JSON.parse(await AsyncStorage.getItem(VISIT_KEY));
    if (
      visit?.sessionKey === sessionKey &&
      Date.now() - visit.startedAt < VISIT_TTL_MS
    )
      return visit;
  } catch {
    // Unreadable storage starts a new visit.
  }
  return newVisit(sessionKey);
};

/**
 * カート管理フック
 * @returns {Object} カート操作と状態
 */
export const useCart = (initialSession = null) => {
  const [items, setItems] = useState([]);
  const initialKey = cartSessionKey(
    initialSession?.restaurantId,
    initialSession?.tableId
  );
  const [sessionKey, setSessionKey] = useState(initialKey);
  const sessionRef = useRef(initialKey);
  const pendingRequest = useRef(null);
  // A lazy initializer loads once; an argument to useRef would run (and
  // store a new visit) on every render.
  const [initialVisit] = useState(() =>
    initialKey ? loadVisit(initialKey) : null
  );
  const visitRef = useRef(initialVisit);
  // null | { state: "checking" | "accepted" | "not_accepted" | "error", payload, result }
  const [recovery, setRecovery] = useState(null);

  // Asks the server about a sent order and returns the state it shows.
  const checkPendingOrder = useCallback(async (key, payload) => {
    setRecovery({ state: "checking", payload });
    try {
      const result = await getOrderRequest(payload);
      if (sessionRef.current !== key) return "error";
      if (!result.accepted) {
        setRecovery({ state: "not_accepted", payload });
        return "not_accepted";
      }
      // Only the first answer acts, so the cart is reduced once.
      if (pendingRequest.current?.payload.requestId === payload.requestId) {
        pendingRequest.current = null;
        forgetPendingOrder();
        // As after a normal success the ordered lines leave the cart. What
        // the customer added since stays, so confirming again cannot repeat
        // the accepted order.
        setItems((cartItems) => withoutOrdered(cartItems, payload.items));
        setRecovery({ state: "accepted", payload, result });
      }
      return "accepted";
    } catch {
      if (sessionRef.current === key) setRecovery({ state: "error", payload });
      return "error";
    }
  }, []);

  // After a reload, find out what happened to an order sent from this table.
  const recoverPendingOrder = useCallback(
    async (key) => {
      let record = null;
      try {
        record = JSON.parse(await AsyncStorage.getItem(PENDING_ORDER_KEY));
      } catch {
        // Unreadable storage is the same as nothing pending.
      }
      if (!record) return;
      if (
        record.sessionKey !== key ||
        !(Date.now() - record.savedAt < PENDING_ORDER_TTL_MS)
      ) {
        forgetPendingOrder();
        return;
      }
      if (sessionRef.current !== key || pendingRequest.current) return;
      pendingRequest.current = record;
      checkPendingOrder(key, record.payload);
    },
    [checkPendingOrder]
  );

  const setSession = useCallback(
    (restaurantId, tableId) => {
      const nextKey = cartSessionKey(restaurantId, tableId);
      if (sessionRef.current !== nextKey) {
        sessionRef.current = nextKey;
        pendingRequest.current = null;
        setItems([]);
        setRecovery(null);
        setSessionKey(nextKey);
        if (nextKey) {
          visitRef.current = loadVisit(nextKey);
          recoverPendingOrder(nextKey);
        }
      }
    },
    [recoverPendingOrder]
  );
  const endSession = useCallback(() => setSession(null, null), [setSession]);

  // Returns what to send. A retry of the same content gets the payload (and
  // request ID) that was sent first, including its language, so the server
  // recognises it. The record is saved before sending to survive a reload.
  // Changed content gets a new ID, but only once the server says the order
  // sent before was not accepted; otherwise this throws with
  // details.reason "previous_order_accepted" or "previous_order_unconfirmed".
  const prepareOrder = useCallback(
    async (orderData) => {
      if (
        !sessionRef.current ||
        cartSessionKey(orderData.restaurantId, orderData.tableId) !==
          sessionRef.current
      ) {
        throw new Error(
          "カートの店舗・テーブルが一致しません。QRから開き直してください。"
        );
      }
      const signature = orderContent(orderData);
      const previous = pendingRequest.current;
      if (previous && previous.signature !== signature) {
        const state = await checkPendingOrder(
          previous.sessionKey,
          previous.payload
        );
        if (state !== "not_accepted")
          throw Object.assign(
            new Error("The order sent before is unresolved"),
            {
              details: {
                reason:
                  state === "accepted"
                    ? "previous_order_accepted"
                    : "previous_order_unconfirmed",
              },
            }
          );
        setRecovery(null);
      }
      if (pendingRequest.current?.signature !== signature) {
        const { visitId } = await visitRef.current;
        pendingRequest.current = {
          signature,
          sessionKey: sessionRef.current,
          payload: { ...orderData, visitId, requestId: createRequestId() },
        };
      }
      // The amounts are not part of what identifies the order. A retry sends
      // today's amounts, so a payload saved under an older rule is not refused.
      const { subtotal, tax, totalAmount } = orderData;
      const pending = {
        ...pendingRequest.current,
        payload: {
          ...pendingRequest.current.payload,
          subtotal,
          tax,
          totalAmount,
        },
      };
      pendingRequest.current = pending;
      await AsyncStorage.setItem(
        PENDING_ORDER_KEY,
        JSON.stringify({ ...pending, savedAt: Date.now() })
      ).catch(() => {});
      return pending.payload;
    },
    [checkPendingOrder]
  );

  // A switched (even subsequently reopened) table must not accept an old result.
  const isOrderRequestCurrent = useCallback(
    (requestId) =>
      !!requestId && pendingRequest.current?.payload.requestId === requestId,
    []
  );

  const retryRecovery = useCallback(() => {
    const pending = pendingRequest.current;
    if (pending && sessionRef.current === pending.sessionKey)
      checkPendingOrder(pending.sessionKey, pending.payload);
  }, [checkPendingOrder]);
  // Put a not-accepted order back in the cart; sending it unchanged reuses its ID.
  const restoreRecoveredOrder = useCallback(() => {
    const payload = pendingRequest.current?.payload;
    if (!payload) return;
    setItems(
      payload.items.map((item) => ({
        id: item.item_id,
        name: item.name,
        name_ja: item.name_ja,
        name_en: item.name_en,
        name_zh: item.name_zh,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes || "",
      }))
    );
    setRecovery(null);
  }, []);
  // The current table's visit, and a way to begin the next one once the
  // server reports the previous visit closed.
  const getVisit = useCallback(() => visitRef.current, []);
  const startNewVisit = useCallback(() => {
    if (sessionRef.current)
      visitRef.current = Promise.resolve(newVisit(sessionRef.current));
  }, []);
  const dismissRecovery = useCallback(() => {
    if (recovery?.state !== "accepted") {
      pendingRequest.current = null;
      forgetPendingOrder();
    }
    setRecovery(null);
  }, [recovery]);

  // 商品を追加
  const addItem = useCallback(
    (item, quantity = 1, notes = "", session = null) => {
      if (!Number.isInteger(quantity) || quantity < MIN_ORDER_QUANTITY)
        return false;
      if (
        !sessionRef.current ||
        (session &&
          cartSessionKey(session.restaurantId, session.tableId) !==
            sessionRef.current)
      )
        return false;
      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex(
          (cartItem) => cartItem.id === item.id && cartItem.notes === notes
        );

        if (existingIndex >= 0) {
          // 既存の商品の数量を増やす
          const newItems = [...prevItems];
          newItems[existingIndex] = {
            ...newItems[existingIndex],
            quantity: Math.min(
              MAX_ORDER_QUANTITY,
              newItems[existingIndex].quantity + quantity
            ),
          };
          return newItems;
        } else {
          // 新しい商品を追加
          return [
            ...prevItems,
            {
              id: item.id,
              name: item.name,
              name_ja: item.name_ja,
              name_en: item.name_en,
              name_zh: item.name_zh,
              name_en_nodic: item.name_en_nodic,
              name_zh_nodic: item.name_zh_nodic,
              name_en_translation: item.name_en_translation,
              name_zh_translation: item.name_zh_translation,
              name_en_nodic_translation: item.name_en_nodic_translation,
              name_zh_nodic_translation: item.name_zh_nodic_translation,
              price: item.price,
              quantity: Math.min(MAX_ORDER_QUANTITY, quantity),
              notes,
              image_url: item.image_url,
            },
          ];
        }
      });
      return true;
    },
    []
  );

  // 商品の数量を更新
  // 商品を削除
  const removeItem = useCallback((itemId, notes = "") => {
    setItems((prevItems) =>
      prevItems.filter((item) => !(item.id === itemId && item.notes === notes))
    );
  }, []);

  // 商品の数量を更新
  const updateQuantity = useCallback(
    (itemId, newQuantity, notes = "") => {
      if (!Number.isInteger(newQuantity)) return false;
      if (newQuantity <= 0) {
        removeItem(itemId, notes);
        return;
      }

      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId && item.notes === notes
            ? { ...item, quantity: Math.min(MAX_ORDER_QUANTITY, newQuantity) }
            : item
        )
      );
    },
    [removeItem]
  );

  // カートをクリア
  const clearCart = useCallback(() => {
    pendingRequest.current = null;
    forgetPendingOrder();
    setItems([]);
  }, []);

  // 小計・税・合計（サーバーと同じ規則で計算する）
  const { subtotal, tax, total } = useMemo(() => totalsOf(items), [items]);

  // カート内の商品数
  const itemCount = useMemo(() => {
    return items.reduce((count, item) => count + item.quantity, 0);
  }, [items]);

  // カートが空かどうか
  const isEmpty = useMemo(() => {
    return items.length === 0;
  }, [items]);

  return {
    items,
    sessionKey,
    setSession,
    endSession,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    prepareOrder,
    isOrderRequestCurrent,
    recovery,
    getVisit,
    startNewVisit,
    retryRecovery,
    restoreRecoveredOrder,
    dismissRecovery,
    subtotal,
    tax,
    total,
    itemCount,
    isEmpty,
  };
};

export default useCart;
