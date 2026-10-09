/**
 * useCartフックのテスト
 */

import { renderHook, act } from "@testing-library/react-native";
import { useCart } from "../useCart";

describe("useCart", () => {
  test("初期状態は空のカート", () => {
    const { result } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));

    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.subtotal).toBe(0);
    expect(result.current.tax).toBe(0);
    expect(result.current.total).toBe(0);
    expect(result.current.isEmpty).toBe(true);
  });

  test("アイテムを追加できる", () => {
    const { result } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));

    const testItem = {
      id: "item_001",
      name: "唐揚げ",
      price: 800,
    };

    act(() => {
      result.current.addItem(testItem, 2, "わさび抜き");
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      id: "item_001",
      name: "唐揚げ",
      price: 800,
      quantity: 2,
      notes: "わさび抜き",
    });
    expect(result.current.itemCount).toBe(2);
    expect(result.current.isEmpty).toBe(false);
  });

  test("同じアイテムを追加すると数量が増える", () => {
    const { result } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));

    const testItem = {
      id: "item_001",
      name: "唐揚げ",
      price: 800,
    };

    act(() => {
      result.current.addItem(testItem, 2);
      result.current.addItem(testItem, 3);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(5);
  });

  test("数量を更新できる", () => {
    const { result } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));

    const testItem = {
      id: "item_001",
      name: "唐揚げ",
      price: 800,
    };

    act(() => {
      result.current.addItem(testItem, 2);
      result.current.updateQuantity("item_001", 5);
    });

    expect(result.current.items[0].quantity).toBe(5);
  });

  test("アイテムを削除できる", () => {
    const { result } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));

    const testItem = {
      id: "item_001",
      name: "唐揚げ",
      price: 800,
    };

    act(() => {
      result.current.addItem(testItem, 2);
      result.current.removeItem("item_001");
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.isEmpty).toBe(true);
  });

  test("カートをクリアできる", () => {
    const { result } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));

    act(() => {
      result.current.addItem({ id: "1", name: "Item 1", price: 100 }, 1);
      result.current.addItem({ id: "2", name: "Item 2", price: 200 }, 2);
      result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.isEmpty).toBe(true);
  });

  test("小計、税、合計が正しく計算される", () => {
    const { result } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));

    act(() => {
      result.current.addItem({ id: "1", name: "Item 1", price: 1000 }, 2); // 2000円
      result.current.addItem({ id: "2", name: "Item 2", price: 500 }, 1); // 500円
    });

    expect(result.current.subtotal).toBe(2500);
    expect(result.current.tax).toBe(250); // 10%
    expect(result.current.total).toBe(2750);
  });

  test("税は切り捨てで計算される", () => {
    const { result } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));

    act(() => {
      result.current.addItem({ id: "1", name: "Item 1", price: 333 }, 3); // 999円
    });

    expect(result.current.subtotal).toBe(999);
    expect(result.current.tax).toBe(99); // 99.9円 → 99円（切り捨て）
    expect(result.current.total).toBe(1098);
  });
});

test("retries keep the order request ID across rerenders until the intent changes", () => {
  const { result, rerender } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));
  const data = { restaurantId: "rest-test", tableId: "table-test", items: [{ item_id: "item-test", quantity: 1 }] };
  let first;
  act(() => { first = result.current.getOrderRequestId(data); });
  rerender();
  expect(result.current.getOrderRequestId({ ...data })).toBe(first);
  expect(() => result.current.getOrderRequestId({ ...data, tableId: "other-table" })).toThrow();
  const next = result.current.getOrderRequestId(data);
  act(() => result.current.clearCart());
  expect(result.current.getOrderRequestId(data)).not.toBe(next);
});

test("cart additions and updates never exceed 99, including repeated additions", () => {
  const { result } = renderHook(() => useCart({ restaurantId: "rest-test", tableId: "table-test" }));
  const item = { id: "item-test", name_ja: "料理", price: 1000 };
  act(() => result.current.addItem(item, 98));
  act(() => result.current.addItem(item, 1));
  expect(result.current.items[0].quantity).toBe(99);
  act(() => result.current.addItem(item, 1));
  expect(result.current.items[0].quantity).toBe(99);
  act(() => result.current.updateQuantity(item.id, 100));
  expect(result.current.items[0].quantity).toBe(99);
  act(() => result.current.updateQuantity(item.id, NaN));
  act(() => result.current.updateQuantity(item.id, 1.5));
  expect(result.current.items[0].quantity).toBe(99);
  act(() => result.current.addItem(item, 100, "different notes"));
  expect(result.current.items[1].quantity).toBe(99);
});
