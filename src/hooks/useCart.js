// カート管理用カスタムフック
import { useState, useCallback, useMemo } from "react";
import { TAX_RATE } from "../constants";

/**
 * カート管理フック
 * @returns {Object} カート操作と状態
 */
export const useCart = () => {
  const [items, setItems] = useState([]);

  // 商品を追加
  const addItem = useCallback((item, quantity = 1, notes = "") => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (cartItem) => cartItem.id === item.id && cartItem.notes === notes
      );

      if (existingIndex >= 0) {
        // 既存の商品の数量を増やす
        const newItems = [...prevItems];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + quantity,
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
            price: item.price,
            quantity,
            notes,
            image_url: item.image_url,
          },
        ];
      }
    });
  }, []);

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
      if (newQuantity <= 0) {
        removeItem(itemId, notes);
        return;
      }

      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId && item.notes === notes
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    },
    [removeItem]
  );

  // カートをクリア
  const clearCart = useCallback(() => {
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
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    tax,
    total,
    itemCount,
    isEmpty,
  };
};

export default useCart;
