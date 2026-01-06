/**
 * 注文処理のテスト
 */

const admin = require("firebase-admin");

// テスト用のモック関数
const mockValidateOrderData = (orderData) => {
  const errors = [];

  if (!orderData.restaurantId) {
    errors.push("Restaurant ID is required");
  }

  if (!orderData.tableId) {
    errors.push("Table ID is required");
  }

  if (
    !orderData.items ||
    !Array.isArray(orderData.items) ||
    orderData.items.length === 0
  ) {
    errors.push("At least one item is required");
  }

  if (orderData.items) {
    orderData.items.forEach((item, index) => {
      if (!item.item_id) {
        errors.push(`Item ${index + 1}: item_id is required`);
      }
      if (!item.quantity || item.quantity < 1 || item.quantity > 99) {
        errors.push(`Item ${index + 1}: quantity must be between 1 and 99`);
      }
      if (item.price === undefined || item.price < 0) {
        errors.push(`Item ${index + 1}: valid price is required`);
      }
      // 特別リクエストのバリデーション
      if (item.special_request && item.special_request.length > 200) {
        errors.push(
          `Item ${index + 1}: special request must be 200 characters or less`,
        );
      }
      // XSS対策: HTMLタグを除去
      if (item.special_request) {
        item.special_request = item.special_request
          .replace(/<[^>]*>/g, "")
          .trim();
      }
    });
  }

  return errors;
};

const mockValidatePriceCalculation = (orderData) => {
  const TAX_RATE = 0.1;

  const calculatedSubtotal = orderData.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const calculatedTax = Math.floor(calculatedSubtotal * TAX_RATE);
  const calculatedTotal = calculatedSubtotal + calculatedTax;

  const isValid =
    Math.abs(calculatedSubtotal - orderData.subtotal) <= 1 &&
    Math.abs(calculatedTax - orderData.tax) <= 1 &&
    Math.abs(calculatedTotal - orderData.totalAmount) <= 1;

  return {
    isValid,
    calculated: {
      subtotal: calculatedSubtotal,
      tax: calculatedTax,
      total: calculatedTotal,
    },
  };
};

describe("注文バリデーション", () => {
  describe("validateOrderData", () => {
    test("有効な注文データはエラーなし", () => {
      const validOrder = {
        restaurantId: "restaurant_001",
        tableId: "table_001",
        items: [
          {
            item_id: "item_001",
            quantity: 2,
            price: 1000,
          },
        ],
      };

      const errors = mockValidateOrderData(validOrder);
      expect(errors).toHaveLength(0);
    });

    test("レストランIDが必須", () => {
      const invalidOrder = {
        tableId: "table_001",
        items: [{ item_id: "item_001", quantity: 1, price: 1000 }],
      };

      const errors = mockValidateOrderData(invalidOrder);
      expect(errors).toContain("Restaurant ID is required");
    });

    test("テーブルIDが必須", () => {
      const invalidOrder = {
        restaurantId: "restaurant_001",
        items: [{ item_id: "item_001", quantity: 1, price: 1000 }],
      };

      const errors = mockValidateOrderData(invalidOrder);
      expect(errors).toContain("Table ID is required");
    });

    test("アイテムが空の場合エラー", () => {
      const invalidOrder = {
        restaurantId: "restaurant_001",
        tableId: "table_001",
        items: [],
      };

      const errors = mockValidateOrderData(invalidOrder);
      expect(errors).toContain("At least one item is required");
    });

    test("数量が1未満の場合エラー", () => {
      const invalidOrder = {
        restaurantId: "restaurant_001",
        tableId: "table_001",
        items: [{ item_id: "item_001", quantity: 0, price: 1000 }],
      };

      const errors = mockValidateOrderData(invalidOrder);
      expect(errors).toContain("Item 1: quantity must be between 1 and 99");
    });

    test("数量が99を超える場合エラー", () => {
      const invalidOrder = {
        restaurantId: "restaurant_001",
        tableId: "table_001",
        items: [{ item_id: "item_001", quantity: 100, price: 1000 }],
      };

      const errors = mockValidateOrderData(invalidOrder);
      expect(errors).toContain("Item 1: quantity must be between 1 and 99");
    });

    test("特別リクエストが200文字を超える場合エラー", () => {
      const longRequest = "a".repeat(201);
      const invalidOrder = {
        restaurantId: "restaurant_001",
        tableId: "table_001",
        items: [
          {
            item_id: "item_001",
            quantity: 1,
            price: 1000,
            special_request: longRequest,
          },
        ],
      };

      const errors = mockValidateOrderData(invalidOrder);
      expect(errors).toContain(
        "Item 1: special request must be 200 characters or less",
      );
    });

    test("HTMLタグがサニタイズされる", () => {
      const orderWithHTML = {
        restaurantId: "restaurant_001",
        tableId: "table_001",
        items: [
          {
            item_id: "item_001",
            quantity: 1,
            price: 1000,
            special_request: "<script>alert('xss')</script>わさび抜き",
          },
        ],
      };

      mockValidateOrderData(orderWithHTML);
      expect(orderWithHTML.items[0].special_request).toBe("わさび抜き");
      expect(orderWithHTML.items[0].special_request).not.toContain("<script>");
    });
  });

  describe("validatePriceCalculation", () => {
    test("正しい金額計算の場合、有効と判定", () => {
      const orderData = {
        items: [
          { price: 1000, quantity: 2 }, // 2000円
          { price: 500, quantity: 1 }, // 500円
        ],
        subtotal: 2500,
        tax: 250, // 10%
        totalAmount: 2750,
      };

      const result = mockValidatePriceCalculation(orderData);
      expect(result.isValid).toBe(true);
      expect(result.calculated.subtotal).toBe(2500);
      expect(result.calculated.tax).toBe(250);
      expect(result.calculated.total).toBe(2750);
    });

    test("金額が1円以内の誤差は許容", () => {
      const orderData = {
        items: [{ price: 333, quantity: 3 }], // 999円
        subtotal: 999,
        tax: 100, // 実際は99.9円だが切り捨てで99円
        totalAmount: 1099,
      };

      const result = mockValidatePriceCalculation(orderData);
      expect(result.isValid).toBe(true);
    });

    test("金額が大きく異なる場合は無効", () => {
      const orderData = {
        items: [{ price: 1000, quantity: 2 }],
        subtotal: 2000,
        tax: 200,
        totalAmount: 3000, // 実際は2200円だが、3000円と主張
      };

      const result = mockValidatePriceCalculation(orderData);
      expect(result.isValid).toBe(false);
    });
  });
});
