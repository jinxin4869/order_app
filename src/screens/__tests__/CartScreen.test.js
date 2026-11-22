/**
 * CartScreenのテスト
 */

// モック（importの前に設定）
jest.mock("../../hooks/useLanguage");
jest.mock("../../services/api", () => ({
  createOrder: jest.fn(),
  getOrderRequest: jest.fn(),
  getMenuAvailability: jest.fn(async () => ({ ordering: "open", soldOut: [] })),
}));

import React from "react";
import { render, waitFor, fireEvent, act } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CartScreen from "../CartScreen";
import { useLanguage } from "../../hooks/useLanguage";
import { useCart } from "../../hooks/useCart";
import { CartContext } from "../../context/CartContext";
import { totalsOf } from "../../utils/price";
import * as api from "../../services/api";

jest.spyOn(Alert, "alert");

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

const mockRoute = {
  params: {
    restaurantId: "restaurant_01",
    tableId: "table_01",
    restaurant: { name: "テストレストラン" },
    table: { table_number: "1" },
  },
};

const mockCartItems = [
  {
    id: "item_01",
    name: "枝豆",
    name_ja: "枝豆",
    name_en_translation: {
      schemaVersion: 1,
      sourceText: "枝豆",
      mode: "dictionary",
      status: "ready",
    },
    name_zh_translation: {
      schemaVersion: 1,
      sourceText: "枝豆",
      mode: "dictionary",
      status: "ready",
    },
    name_en: "Edamame",
    name_zh: "毛豆",
    price: 500,
    quantity: 2,
    notes: "",
  },
  {
    id: "item_02",
    name: "唐揚げ",
    name_ja: "唐揚げ",
    name_en_translation: {
      schemaVersion: 1,
      sourceText: "唐揚げ",
      mode: "dictionary",
      status: "ready",
    },
    name_zh_translation: {
      schemaVersion: 1,
      sourceText: "唐揚げ",
      mode: "dictionary",
      status: "ready",
    },
    name_en: "Fried Chicken",
    name_zh: "炸鸡",
    price: 800,
    quantity: 1,
    notes: "わさび抜き",
  },
];

const createMockCartContext = (items = []) => ({
  items,
  updateQuantity: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
  prepareOrder: jest.fn(async (data) => ({
    ...data,
    requestId: "request-screen-test",
  })),
  isOrderRequestCurrent: jest.fn(() => true),
  ...totalsOf(items),
  isEmpty: items.length === 0,
  itemCount: items.reduce((count, item) => count + item.quantity, 0),
});

describe("CartScreen", () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});

    useLanguage.mockReturnValue({
      currentLanguage: "ja",
    });

    api.createOrder.mockResolvedValue({
      orderId: "order_001",
      orderNumber: "001",
    });
  });

  test("カートアイテムを表示する", async () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("枝豆")).toBeTruthy();
    expect(getByText("唐揚げ")).toBeTruthy();
    expect(getByText("📝 わさび抜き")).toBeTruthy();
  });

  test("空のカート時にメッセージを表示", async () => {
    const mockContext = createMockCartContext([]);

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("カートは空です")).toBeTruthy();
    expect(getByText("メニューから商品を追加してください")).toBeTruthy();
    expect(getByText("メニューに戻る")).toBeTruthy();
  });

  test("空のカートから「メニューに戻る」ボタンで戻る", async () => {
    const mockContext = createMockCartContext([]);

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    await fireEvent.press(getByText("メニューに戻る"));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test("数量を増やすボタンが機能する", async () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getAllByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const plusButtons = getAllByText("+");
    await fireEvent.press(plusButtons[0]);

    expect(mockContext.updateQuantity).toHaveBeenCalledWith("item_01", 3, "");
  });

  test("数量を減らすボタンが機能する", async () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getAllByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const minusButtons = getAllByText("−");
    await fireEvent.press(minusButtons[0]);

    expect(mockContext.updateQuantity).toHaveBeenCalledWith("item_01", 1, "");
  });

  test("削除ボタンをタップすると確認ダイアログを表示", async () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getAllByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    const deleteButtons = getAllByText("×");
    await fireEvent.press(deleteButtons[0]);

    expect(Alert.alert).toHaveBeenCalledWith(
      "削除確認",
      "「枝豆」をカートから削除しますか？",
      expect.any(Array)
    );
  });

  test("言語切り替え時に正しい言語でアイテム名を表示", async () => {
    useLanguage.mockReturnValue({
      currentLanguage: "en",
    });

    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("Edamame")).toBeTruthy();
    expect(getByText("Fried Chicken")).toBeTruthy();
  });

  test("注文確定ボタンをタップすると確認ダイアログを表示", async () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    await fireEvent.press(getByText("注文を確定する"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "注文確認",
      "合計 ¥1,980（税込）で注文を確定しますか？",
      expect.any(Array)
    );
  });

  test("注文確定が成功すると注文完了画面に遷移", async () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    // 確認ダイアログをモック
    Alert.alert.mockImplementation((title, message, buttons) => {
      const confirmButton = buttons.find((b) => b.text === "注文する");
      if (confirmButton) confirmButton.onPress();
    });

    await fireEvent.press(getByText("注文を確定する"));

    await waitFor(() => {
      expect(api.createOrder).toHaveBeenCalledWith({
        requestId: "request-screen-test",
        restaurantId: "restaurant_01",
        tableId: "table_01",
        customerLanguage: "ja",
        items: expect.any(Array),
        subtotal: expect.any(Number),
        tax: expect.any(Number),
        totalAmount: expect.any(Number),
      });

      expect(mockContext.clearCart).toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith("OrderComplete", {
        orderId: "order_001",
        orderNumber: "001",
        total: expect.any(Number),
        restaurantId: "restaurant_01",
        tableId: "table_01",
        restaurant: mockRoute.params.restaurant,
        table: mockRoute.params.table,
      });
    });
  });

  test("注文確定が失敗するとエラーメッセージを表示", async () => {
    api.createOrder.mockRejectedValue(new Error("ネットワークエラー"));

    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    // 確認ダイアログをモック
    Alert.alert.mockImplementation((title, message, buttons) => {
      if (buttons && Array.isArray(buttons)) {
        const confirmButton = buttons.find((b) => b.text === "注文する");
        if (confirmButton) confirmButton.onPress();
      }
    });

    await fireEvent.press(getByText("注文を確定する"));

    await waitFor(() => {
      // 通信の失敗では受付済みの可能性があるため、同じ内容での再送を案内する
      expect(Alert.alert).toHaveBeenCalledWith(
        "エラー",
        "注文の結果を確認できませんでした。通信を確認して、もう一度「注文を確定する」を押してください。同じ内容なら注文は重複しません。"
      );
    });
  });

  test("サーバーが拒否した注文は、再送ではなく内容の確認を案内する", async () => {
    api.createOrder.mockRejectedValue(
      Object.assign(new Error("closed"), {
        code: "functions/failed-precondition",
        details: { reason: "restaurant_closed" },
      })
    );
    const mockContext = createMockCartContext(mockCartItems);
    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    Alert.alert.mockImplementation((title, message, buttons) => {
      const confirm = buttons?.find((b) => b.text === "注文する");
      if (confirm) confirm.onPress();
    });
    await fireEvent.press(getByText("注文を確定する"));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "エラー",
        "注文を受け付けられませんでした。内容を確認してください。"
      )
    );
  });

  test("戻るボタンをタップすると前の画面に戻る", async () => {
    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    await fireEvent.press(getByText("←"));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test("中国語表示時に正しく翻訳される", async () => {
    useLanguage.mockReturnValue({
      currentLanguage: "zh",
    });

    const mockContext = createMockCartContext(mockCartItems);

    const { getByText } = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );

    expect(getByText("毛豆")).toBeTruthy();
    expect(getByText("炸鸡")).toBeTruthy();
    expect(getByText("购物车")).toBeTruthy();
  });

  test("Webの確認から注文APIまで進める", async () => {
    jest.replaceProperty(Platform, "OS", "web");
    window.confirm = jest.fn().mockReturnValue(true);
    const context = createMockCartContext(mockCartItems);
    const { getByText } = await render(
      <CartContext.Provider value={context}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    await fireEvent.press(getByText("注文を確定する"));
    await waitFor(() => expect(api.createOrder).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        "OrderComplete",
        expect.objectContaining({ orderId: "order_001" })
      )
    );
  });

  test("Webで注文確認を取り消すとAPIを呼ばない", async () => {
    jest.replaceProperty(Platform, "OS", "web");
    window.confirm = jest.fn().mockReturnValue(false);
    const context = createMockCartContext(mockCartItems);
    const { getByText } = await render(
      <CartContext.Provider value={context}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    await fireEvent.press(getByText("注文を確定する"));
    expect(api.createOrder).not.toHaveBeenCalled();
  });
  test("a sold-out row blocks ordering until it is removed", async () => {
    api.getMenuAvailability.mockResolvedValueOnce({
      ordering: "open",
      soldOut: [mockCartItems[0].id],
    });
    const mockContext = createMockCartContext(mockCartItems);
    const screen = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    expect(
      await screen.findByText(
        "売り切れのため注文できません。カートから削除してください。"
      )
    ).toBeTruthy();
    const submit = screen.getByRole("button", { name: "注文を確定する" });
    expect(submit.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(submit);
    expect(api.createOrder).not.toHaveBeenCalled();
  });

  test("while ordering is paused the cart is kept but cannot be sent", async () => {
    api.getMenuAvailability.mockResolvedValueOnce({
      ordering: "paused",
      soldOut: [],
    });
    const mockContext = createMockCartContext(mockCartItems);
    const screen = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    expect(
      await screen.findByText(
        "現在、注文受付を一時停止しています。スタッフへお声がけください。"
      )
    ).toBeTruthy();
    expect(screen.getByText("枝豆")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "注文を確定する" }).props
        .accessibilityState.disabled
    ).toBe(true);
  });

  test("an item refused as sold out at ordering time is marked in the cart", async () => {
    api.createOrder.mockRejectedValue(
      Object.assign(new Error("sold out"), {
        code: "functions/failed-precondition",
        details: { reason: "item_unavailable", itemId: mockCartItems[1].id },
      })
    );
    const mockContext = createMockCartContext(mockCartItems);
    const screen = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    Alert.alert.mockImplementation((title, message, buttons) => {
      const confirm = buttons?.find((b) => b.text === "注文する");
      if (confirm) confirm.onPress();
    });
    await fireEvent.press(screen.getByText("注文を確定する"));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "売り切れの商品があります",
        expect.stringContaining("注文は送信されていません")
      )
    );
    expect(
      screen.getByText(
        "売り切れのため注文できません。カートから削除してください。"
      )
    ).toBeTruthy();
    expect(mockContext.clearCart).not.toHaveBeenCalled();
  });
  test("a rate-limited order says when to try again and keeps the cart", async () => {
    api.createOrder.mockRejectedValue(
      Object.assign(new Error("limited"), {
        code: "functions/resource-exhausted",
        details: { reason: "rate_limited", retryAfterSeconds: 290 },
      })
    );
    const mockContext = createMockCartContext(mockCartItems);
    const screen = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    Alert.alert.mockImplementation((title, message, buttons) => {
      const confirm = buttons?.find((b) => b.text === "注文する");
      if (confirm) confirm.onPress();
    });
    await fireEvent.press(screen.getByText("注文を確定する"));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "しばらくお待ちください",
        expect.stringContaining("約5分後にもう一度お試しいただくか")
      )
    );
    expect(mockContext.clearCart).not.toHaveBeenCalled();
  });
  test("the scanned table token is sent with the order", async () => {
    const mockContext = createMockCartContext(mockCartItems);
    const route = {
      params: {
        ...mockRoute.params,
        table: { ...mockRoute.params.table, token: "abcdefghijklmnop_-12" },
      },
    };
    const screen = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={route} />
      </CartContext.Provider>
    );
    Alert.alert.mockImplementation((title, message, buttons) => {
      const confirm = buttons?.find((b) => b.text === "注文する");
      if (confirm) confirm.onPress();
    });
    await fireEvent.press(screen.getByText("注文を確定する"));
    await waitFor(() =>
      expect(api.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ tableToken: "abcdefghijklmnop_-12" })
      )
    );
  });

  test("a refused table token asks the customer to scan the table again", async () => {
    api.createOrder.mockRejectedValue(
      Object.assign(new Error("token"), {
        code: "functions/failed-precondition",
        details: { reason: "table_token_invalid" },
      })
    );
    const mockContext = createMockCartContext(mockCartItems);
    const screen = await render(
      <CartContext.Provider value={mockContext}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    Alert.alert.mockImplementation((title, message, buttons) => {
      const confirm = buttons?.find((b) => b.text === "注文する");
      if (confirm) confirm.onPress();
    });
    await fireEvent.press(screen.getByText("注文を確定する"));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "QRコードを読み取り直してください",
        expect.stringContaining("注文は送信されていません")
      )
    );
  });
});

test("price changes prompt a fresh menu and clear the outdated cart on confirmation", async () => {
  jest.clearAllMocks();
  useLanguage.mockReturnValue({ currentLanguage: "ja" });
  api.createOrder.mockRejectedValue(
    Object.assign(new Error("Price changed"), {
      details: { reason: "price_changed" },
    })
  );
  const context = createMockCartContext(mockCartItems);
  const navigation = { ...mockNavigation, replace: jest.fn() };
  jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
    if (title === "注文確認") buttons[1].onPress();
  });
  const view = await render(
    <CartContext.Provider value={context}>
      <CartScreen navigation={navigation} route={mockRoute} />
    </CartContext.Provider>
  );
  await fireEvent.press(view.getByText("注文を確定する"));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      "メニュー更新が必要です",
      expect.any(String),
      expect.any(Array)
    )
  );
  const prompt = Alert.alert.mock.calls.find(
    ([title]) => title === "メニュー更新が必要です"
  );
  prompt[2][0].onPress();
  expect(context.clearCart).toHaveBeenCalledTimes(1);
  expect(navigation.replace).toHaveBeenCalledWith("Menu", mockRoute.params);
});

test("the cart shows the quantity limit and disables further increments at 99", async () => {
  jest.clearAllMocks();
  useLanguage.mockReturnValue({ currentLanguage: "ja" });
  const context = createMockCartContext([
    { ...mockCartItems[0], quantity: 99 },
  ]);
  const view = await render(
    <CartContext.Provider value={context}>
      <CartScreen navigation={mockNavigation} route={mockRoute} />
    </CartContext.Provider>
  );
  expect(view.getByText("上限99個")).toBeTruthy();
  await fireEvent.press(view.getByRole("button", { name: "数量を増やす" }));
  expect(context.updateQuantity).not.toHaveBeenCalled();
});

describe("the total quantity of one order", () => {
  const renderCart = async (quantities) => {
    jest.clearAllMocks();
    useLanguage.mockReturnValue({ currentLanguage: "ja" });
    const context = createMockCartContext(
      quantities.map((quantity, index) => ({
        ...mockCartItems[index],
        quantity,
      }))
    );
    const view = await render(
      <CartContext.Provider value={context}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
    return { context, view };
  };
  test("at the limit, the cart says so and no line can be increased", async () => {
    const { context, view } = await renderCart([60, 40]);
    expect(
      view.getByText("1回の注文は合計100個までです（カート内100個）")
    ).toBeTruthy();
    for (const button of view.getAllByRole("button", {
      name: "数量を増やす",
    })) {
      expect(button.props.accessibilityState.disabled).toBe(true);
      await fireEvent.press(button);
    }
    expect(context.updateQuantity).not.toHaveBeenCalled();
    const submit = view.getByRole("button", { name: "注文を確定する" });
    expect(submit.props.accessibilityState.disabled).toBe(false);
  });
  test("over the limit, ordering is blocked until the customer reduces it", async () => {
    const { view } = await renderCart([99, 2]);
    expect(
      view.getByText(
        "1回の注文は合計100個までです（カート内101個）。数量を減らしてください。"
      )
    ).toBeTruthy();
    const submit = view.getByRole("button", { name: "注文を確定する" });
    expect(submit.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(submit);
    expect(api.createOrder).not.toHaveBeenCalled();
  });
  test("below the limit, nothing is shown", async () => {
    const { view } = await renderCart([2, 1]);
    expect(view.queryByText(/1回の注文は合計/)).toBeNull();
  });
});

// #139: the screen with the real cart hook behind it, as in the app.
describe("confirming again after an order with an unknown result", () => {
  const CartWithHook = ({ cart }) => {
    cart.current = useCart({
      restaurantId: "restaurant_01",
      tableId: "table_01",
    });
    return (
      <CartContext.Provider value={cart.current}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
  };
  // Two 枝豆 are sent and the response is lost. With `change`, the customer
  // then adds a 唐揚げ before confirming again.
  const afterLostResponse = async ({ change = true } = {}) => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    useLanguage.mockReturnValue({ currentLanguage: "ja" });
    jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
      buttons?.find((button) => button.text === "注文する")?.onPress();
    });
    api.getOrderRequest.mockReset();
    api.createOrder.mockReset();
    api.createOrder.mockResolvedValue({
      orderId: "order_002",
      orderNumber: "002",
    });
    api.createOrder.mockRejectedValueOnce(new Error("ネットワークエラー"));
    const cart = { current: null };
    const view = await render(<CartWithHook cart={cart} />);
    await act(() => cart.current.addItem(mockCartItems[0], 2));
    await fireEvent.press(view.getByText("注文を確定する"));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "エラー",
        expect.stringContaining("同じ内容なら注文は重複しません")
      )
    );
    if (change) await act(() => cart.current.addItem(mockCartItems[1], 1));
    return { view, first: api.createOrder.mock.calls[0][0] };
  };

  test("a first order that was accepted is reported and the changed cart is not sent", async () => {
    const { view, first } = await afterLostResponse();
    api.getOrderRequest.mockResolvedValue({
      accepted: true,
      orderId: "order_001",
      orderNumber: "20261025-001",
    });
    await fireEvent.press(view.getByText("注文を確定する"));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "前回の注文は受付済みです",
        expect.stringContaining("新しい注文は送信していません")
      )
    );
    expect(api.getOrderRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: first.requestId })
    );
    expect(api.createOrder).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(
      view.getByText(
        "前回の注文は受け付けられています（注文番号 20261025-001）。"
      )
    ).toBeTruthy();
    // The accepted 枝豆 leave the cart; the 唐揚げ added afterwards stays.
    expect(view.queryByText("枝豆")).toBeNull();
    expect(view.getByText("唐揚げ")).toBeTruthy();
  });

  test("a first order that cannot be checked blocks the changed cart and says what to do", async () => {
    const { view } = await afterLostResponse();
    api.getOrderRequest.mockRejectedValue(new Error("offline"));
    await fireEvent.press(view.getByText("注文を確定する"));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "前回の注文を確認できません",
        expect.stringContaining("新しい注文は送信していません")
      )
    );
    expect(api.createOrder).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(
      view.getByText(
        "前回の注文の受付状況を確認できません。通信を確認してください。"
      )
    ).toBeTruthy();
    expect(view.getByText("枝豆")).toBeTruthy();
    expect(view.getByText("唐揚げ")).toBeTruthy();
  });

  test("a first order that was not accepted lets the changed cart go out under a new ID", async () => {
    const { view, first } = await afterLostResponse();
    api.getOrderRequest.mockResolvedValue({ accepted: false });
    await fireEvent.press(view.getByText("注文を確定する"));
    await waitFor(() =>
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        "OrderComplete",
        expect.objectContaining({ orderId: "order_002" })
      )
    );
    expect(api.getOrderRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: first.requestId })
    );
    expect(api.createOrder).toHaveBeenCalledTimes(2);
    const second = api.createOrder.mock.calls[1][0];
    expect(second.requestId).not.toBe(first.requestId);
    expect(second.items.map((item) => item.item_id)).toEqual([
      "item_01",
      "item_02",
    ]);
  });

  test("an unchanged cart is resent with the same ID, without checking first", async () => {
    const { view, first } = await afterLostResponse({ change: false });
    await fireEvent.press(view.getByText("注文を確定する"));
    await waitFor(() =>
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        "OrderComplete",
        expect.objectContaining({ orderId: "order_002" })
      )
    );
    expect(api.createOrder).toHaveBeenCalledTimes(2);
    expect(api.createOrder.mock.calls[1][0]).toEqual(first);
    expect(api.getOrderRequest).not.toHaveBeenCalled();
  });
});

// #138: the customer sees what each line costs and the total before ordering.
describe("prices before ordering", () => {
  const CartWithHook = ({ cart }) => {
    cart.current = useCart({
      restaurantId: "restaurant_01",
      tableId: "table_01",
    });
    return (
      <CartContext.Provider value={cart.current}>
        <CartScreen navigation={mockNavigation} route={mockRoute} />
      </CartContext.Provider>
    );
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    api.createOrder.mockReset();
    api.createOrder.mockResolvedValue({ orderId: "order_001" });
  });

  test.each([
    ["ja", "合計（税込）", "合計 ¥1,308（税込）で注文を確定しますか？"],
    ["en", "Total (incl. tax)", "Place this order for ¥1,308 (incl. tax)?"],
    ["zh", "合计（含税）", "确认以合计 ¥1,308（含税）下单吗？"],
  ])(
    "%s: the lines add up to the total shown, confirmed and sent",
    async (language, totalLabel, question) => {
      useLanguage.mockReturnValue({ currentLanguage: language });
      jest
        .spyOn(Alert, "alert")
        .mockImplementation((title, message, buttons) =>
          buttons?.find((button) => button.style !== "cancel")?.onPress()
        );
      const cart = { current: null };
      const view = await render(<CartWithHook cart={cart} />);
      // ¥95 before tax is ¥104 with tax; two of them are ¥208, not ¥209.
      await act(() => cart.current.addItem({ id: "tea", price: 95 }, 2));
      await act(() => cart.current.addItem({ id: "rice", price: 1000 }, 1));
      expect(view.getByText(/^¥208/)).toBeTruthy();
      expect(view.getByText("  ¥104 × 2")).toBeTruthy();
      expect(view.getByText("¥1,100")).toBeTruthy();
      expect(view.getByText(totalLabel)).toBeTruthy();
      expect(view.getByText("¥1,308")).toBeTruthy();

      await fireEvent.press(
        view.getByText(/^(注文を確定する|Place Order|确认订单)$/)
      );
      expect(Alert.alert.mock.calls[0][1]).toBe(question);
      await waitFor(() =>
        expect(api.createOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            subtotal: 1190,
            tax: 118,
            totalAmount: 1308,
          })
        )
      );
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        "OrderComplete",
        expect.objectContaining({ total: 1308 })
      );
    }
  );
});
