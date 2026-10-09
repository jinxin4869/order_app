// カート管理用カスタムフック
import { useState, useCallback, useMemo, useRef } from "react";
import { TAX_RATE, MIN_ORDER_QUANTITY, MAX_ORDER_QUANTITY } from "../constants";
import { createRequestId } from "../utils/requestId";
import { cartSessionKey } from "../utils/cartSession";

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
  const setSession = useCallback((restaurantId, tableId) => {
    const nextKey = cartSessionKey(restaurantId, tableId);
    if (sessionRef.current !== nextKey) {
      sessionRef.current = nextKey;
      pendingRequest.current = null;
      setItems([]);
      setSessionKey(nextKey);
    }
  }, []);
  const endSession = useCallback(() => setSession(null, null), [setSession]);
  const getOrderRequestId = useCallback((orderData) => {
    if (
      !sessionRef.current ||
      cartSessionKey(orderData.restaurantId, orderData.tableId) !==
        sessionRef.current
    ) {
      throw new Error(
        "カートの店舗・テーブルが一致しません。QRから開き直してください。"
      );
    }
    const signature = JSON.stringify(orderData);
    if (pendingRequest.current?.signature !== signature) {
      pendingRequest.current = { signature, id: createRequestId() };
    }
    return pendingRequest.current.id;
  }, []);

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
    setItems([]);
  }, []);

  // 小計を計算
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  // 税額を計算
  const tax = useMemo(() => {
    return Math.floor(subtotal * TAX_RATE);
  }, [subtotal]);

  // 合計を計算
  const total = useMemo(() => {
    return subtotal + tax;
  }, [subtotal, tax]);

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
    getOrderRequestId,
    subtotal,
    tax,
    total,
    itemCount,
    isEmpty,
  };
};

export default useCart;
