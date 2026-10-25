/**
 * useCartフックのテスト
 */

import { renderHook, act, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCart } from "../useCart";
import { getOrderRequest } from "../../services/api";
jest.mock("../../services/api", () => ({ getOrderRequest: jest.fn() }));
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("useCart", () => {
  test("初期状態は空のカート", async () => {
    const { result } = await renderHook(() =>
      useCart({ restaurantId: "rest-test", tableId: "table-test" })
    );

    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.subtotal).toBe(0);
    expect(result.current.tax).toBe(0);
    expect(result.current.total).toBe(0);
    expect(result.current.isEmpty).toBe(true);
  });

  test("アイテムを追加できる", async () => {
    const { result } = await renderHook(() =>
      useCart({ restaurantId: "rest-test", tableId: "table-test" })
    );

    const testItem = {
      id: "item_001",
      name: "唐揚げ",
      price: 800,
    };

    await act(() => {
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

  test("同じアイテムを追加すると数量が増える", async () => {
    const { result } = await renderHook(() =>
      useCart({ restaurantId: "rest-test", tableId: "table-test" })
    );

    const testItem = {
      id: "item_001",
      name: "唐揚げ",
      price: 800,
    };

    await act(() => {
      result.current.addItem(testItem, 2);
      result.current.addItem(testItem, 3);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(5);
  });

  test("数量を更新できる", async () => {
    const { result } = await renderHook(() =>
      useCart({ restaurantId: "rest-test", tableId: "table-test" })
    );

    const testItem = {
      id: "item_001",
      name: "唐揚げ",
      price: 800,
    };

    await act(() => {
      result.current.addItem(testItem, 2);
      result.current.updateQuantity("item_001", 5);
    });

    expect(result.current.items[0].quantity).toBe(5);
  });

  test("アイテムを削除できる", async () => {
    const { result } = await renderHook(() =>
      useCart({ restaurantId: "rest-test", tableId: "table-test" })
    );

    const testItem = {
      id: "item_001",
      name: "唐揚げ",
      price: 800,
    };

    await act(() => {
      result.current.addItem(testItem, 2);
      result.current.removeItem("item_001");
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.isEmpty).toBe(true);
  });

  test("カートをクリアできる", async () => {
    const { result } = await renderHook(() =>
      useCart({ restaurantId: "rest-test", tableId: "table-test" })
    );

    await act(() => {
      result.current.addItem({ id: "1", name: "Item 1", price: 100 }, 1);
      result.current.addItem({ id: "2", name: "Item 2", price: 200 }, 2);
      result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.isEmpty).toBe(true);
  });

  test("小計、税、合計が正しく計算される", async () => {
    const { result } = await renderHook(() =>
      useCart({ restaurantId: "rest-test", tableId: "table-test" })
    );

    await act(() => {
      result.current.addItem({ id: "1", name: "Item 1", price: 1000 }, 2); // 2000円
      result.current.addItem({ id: "2", name: "Item 2", price: 500 }, 1); // 500円
    });

    expect(result.current.subtotal).toBe(2500);
    expect(result.current.tax).toBe(250); // 10%
    expect(result.current.total).toBe(2750);
  });

  test("税は切り捨てで計算される", async () => {
    const { result } = await renderHook(() =>
      useCart({ restaurantId: "rest-test", tableId: "table-test" })
    );

    await act(() => {
      result.current.addItem({ id: "1", name: "Item 1", price: 333 }, 3); // 999円
    });

    expect(result.current.subtotal).toBe(999);
    expect(result.current.tax).toBe(99); // 99.9円 → 99円（切り捨て）
    expect(result.current.total).toBe(1098);
  });
});

test("retries keep the order request ID across rerenders until the intent changes", async () => {
  const { result, rerender } = await renderHook(() =>
    useCart({ restaurantId: "rest-test", tableId: "table-test" })
  );
  const data = {
    restaurantId: "rest-test",
    tableId: "table-test",
    items: [{ item_id: "item-test", quantity: 1 }],
  };
  const idOf = async (value) =>
    (await result.current.prepareOrder(value)).requestId;
  const first = await idOf(data);
  await rerender();
  expect(await idOf({ ...data })).toBe(first);
  await expect(
    result.current.prepareOrder({ ...data, tableId: "other-table" })
  ).rejects.toThrow();
  const next = await idOf(data);
  await act(() => result.current.clearCart());
  expect(await idOf(data)).not.toBe(next);
});

test("cart additions and updates never exceed 99, including repeated additions", async () => {
  const { result } = await renderHook(() =>
    useCart({ restaurantId: "rest-test", tableId: "table-test" })
  );
  const item = { id: "item-test", name_ja: "料理", price: 1000 };
  await act(() => result.current.addItem(item, 98));
  await act(() => result.current.addItem(item, 1));
  expect(result.current.items[0].quantity).toBe(99);
  await act(() => result.current.addItem(item, 1));
  expect(result.current.items[0].quantity).toBe(99);
  await act(() => result.current.updateQuantity(item.id, 100));
  expect(result.current.items[0].quantity).toBe(99);
  await act(() => result.current.updateQuantity(item.id, NaN));
  await act(() => result.current.updateQuantity(item.id, 1.5));
  expect(result.current.items[0].quantity).toBe(99);
  await act(() => result.current.addItem(item, 100, "different notes"));
  expect(result.current.items[1].quantity).toBe(99);
});

const STORED = "@qr_order_pending";
const orderData = (overrides = {}) => ({
  restaurantId: "rest-test",
  tableId: "table-test",
  customerLanguage: "ja",
  items: [
    {
      item_id: "item-test",
      name: "料理",
      name_ja: "料理",
      name_en: "Dish",
      name_zh: "菜",
      quantity: 1,
      price: 1000,
      notes: null,
    },
  ],
  subtotal: 1000,
  tax: 100,
  totalAmount: 1100,
  ...overrides,
});
const sentBefore = async () => {
  const { result, unmount } = await renderHook(() =>
    useCart({ restaurantId: "rest-test", tableId: "table-test" })
  );
  const payload = await result.current.prepareOrder(orderData());
  await unmount();
  return payload;
};
// A new app instance, as after a page reload; the route then opens the table.
const reopen = async (tableId = "table-test") => {
  const view = await renderHook(() => useCart());
  await act(() => view.result.current.setSession("rest-test", tableId));
  return view;
};

test("a language change after a lost response resends the first payload and ID", async () => {
  const { result } = await renderHook(() =>
    useCart({ restaurantId: "rest-test", tableId: "table-test" })
  );
  const first = await result.current.prepareOrder(orderData());
  const english = orderData({
    customerLanguage: "en",
    items: [{ ...orderData().items[0], name: "Dish" }],
  });
  expect(await result.current.prepareOrder(english)).toEqual(first);
  expect(first.customerLanguage).toBe("ja");
  const changed = orderData({
    items: [{ ...orderData().items[0], quantity: 2 }],
  });
  expect((await result.current.prepareOrder(changed)).requestId).not.toBe(
    first.requestId
  );
});
test("the pending order is stored before sending and forgotten with the cart", async () => {
  const { result } = await renderHook(() =>
    useCart({ restaurantId: "rest-test", tableId: "table-test" })
  );
  const payload = await result.current.prepareOrder(orderData());
  expect(JSON.parse(await AsyncStorage.getItem(STORED))).toMatchObject({
    sessionKey: "rest-test/table-test",
    payload,
    savedAt: expect.any(Number),
  });
  await act(() => result.current.clearCart());
  expect(await AsyncStorage.getItem(STORED)).toBeNull();
});
test("after a reload, an accepted order is reported and forgotten", async () => {
  const payload = await sentBefore();
  getOrderRequest.mockResolvedValue({
    accepted: true,
    orderId: "order-1",
    orderNumber: "20261025-001",
  });
  const { result } = await reopen();
  await waitFor(() => expect(result.current.recovery?.state).toBe("accepted"));
  expect(getOrderRequest).toHaveBeenCalledWith(payload);
  expect(result.current.recovery.result.orderNumber).toBe("20261025-001");
  expect(await AsyncStorage.getItem(STORED)).toBeNull();
});
test("after a reload, an order that was not accepted can be put back and resent with its ID", async () => {
  const payload = await sentBefore();
  getOrderRequest.mockResolvedValue({ accepted: false });
  const { result } = await reopen();
  await waitFor(() =>
    expect(result.current.recovery?.state).toBe("not_accepted")
  );
  expect(result.current.items).toEqual([]);
  await act(() => result.current.restoreRecoveredOrder());
  expect(result.current.recovery).toBeNull();
  expect(result.current.items).toEqual([
    expect.objectContaining({ id: "item-test", quantity: 1, price: 1000 }),
  ]);
  const resent = await result.current.prepareOrder(
    orderData({ customerLanguage: "en" })
  );
  expect(resent.requestId).toBe(payload.requestId);
});
test("a failed check can be retried, and discarding forgets the order", async () => {
  await sentBefore();
  getOrderRequest.mockRejectedValueOnce(new Error("offline"));
  getOrderRequest.mockResolvedValueOnce({ accepted: false });
  const { result } = await reopen();
  await waitFor(() => expect(result.current.recovery?.state).toBe("error"));
  await act(() => result.current.retryRecovery());
  await waitFor(() =>
    expect(result.current.recovery?.state).toBe("not_accepted")
  );
  await act(() => result.current.dismissRecovery());
  expect(result.current.recovery).toBeNull();
  expect(await AsyncStorage.getItem(STORED)).toBeNull();
});
test("another table or an expired record is discarded without asking the server", async () => {
  await sentBefore();
  await reopen("table-other");
  await waitFor(async () =>
    expect(await AsyncStorage.getItem(STORED)).toBeNull()
  );
  const payload = await sentBefore();
  await AsyncStorage.setItem(
    STORED,
    JSON.stringify({
      sessionKey: "rest-test/table-test",
      payload,
      savedAt: Date.now() - 4 * 60 * 60 * 1000,
    })
  );
  const { result } = await reopen();
  await waitFor(async () =>
    expect(await AsyncStorage.getItem(STORED)).toBeNull()
  );
  expect(result.current.recovery).toBeNull();
  expect(getOrderRequest).not.toHaveBeenCalled();
});
test("a check that answers after switching tables does not touch the new table", async () => {
  await sentBefore();
  let answer;
  getOrderRequest.mockImplementation(
    () => new Promise((resolve) => (answer = resolve))
  );
  const { result } = await reopen();
  await waitFor(() => expect(answer).toBeDefined());
  await act(() => result.current.setSession("rest-test", "table-other"));
  await act(async () =>
    answer({ accepted: true, orderId: "order-1", orderNumber: "001" })
  );
  expect(result.current.recovery).toBeNull();
});
