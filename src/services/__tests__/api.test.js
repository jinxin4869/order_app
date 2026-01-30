/**
 * API サービスのテスト
 */

// モック（importの前に設定）
jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn(),
}));

jest.mock("../firebase", () => ({
  functions: {},
}));

jest.mock("../../utils/errorHandler", () => ({
  withRetry: jest.fn((fn) => fn()),
  handleError: jest.fn((error) => error.message || "エラーが発生しました"),
}));

import { httpsCallable } from "firebase/functions";
import {
  translateText,
  batchTranslateMenu,
  createOrder,
  updateOrderStatus,
  getMenuWithTranslation,
  validateQRCode,
} from "../api";
import { withRetry, handleError } from "../../utils/errorHandler";

describe("API Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // errorHandlerのモックをリセット
    withRetry.mockImplementation((fn) => fn());
    handleError.mockImplementation(
      (error) => error.message || "エラーが発生しました"
    );
  });

  describe("translateText", () => {
    test("テキストを正しく翻訳する", async () => {
      const mockResult = {
        data: {
          translatedText: "Hello",
          fromCache: false,
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await translateText("こんにちは", "en");

      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "translateText"
      );
      expect(mockFunction).toHaveBeenCalledWith({
        text: "こんにちは",
        targetLang: "en",
        useDictionary: true,
      });
      expect(result).toEqual(mockResult.data);
    });

    test("翻訳エラー時に例外をスローする", async () => {
      const mockError = new Error("Translation failed");
      const mockFunction = jest.fn().mockRejectedValue(mockError);
      httpsCallable.mockReturnValue(mockFunction);

      await expect(translateText("test", "en")).rejects.toThrow(
        "Translation failed"
      );
      expect(handleError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({ function: "translateText" })
      );
    });

    test("キャッシュから翻訳を取得する", async () => {
      const mockResult = {
        data: {
          translatedText: "Hello",
          fromCache: true,
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await translateText("こんにちは", "en");

      expect(result.fromCache).toBe(true);
    });

    test("辞書なしで翻訳する（A/Bテスト用）", async () => {
      const mockResult = {
        data: {
          translatedText: "Hello",
          fromCache: false,
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await translateText("こんにちは", "en", {
        useDictionary: false,
      });

      expect(mockFunction).toHaveBeenCalledWith({
        text: "こんにちは",
        targetLang: "en",
        useDictionary: false,
      });
      expect(result).toEqual(mockResult.data);
    });
  });

  describe("batchTranslateMenu", () => {
    test("メニューを一括翻訳する", async () => {
      const mockResult = {
        data: {
          count: 10,
          items: [{ id: "item_01", name_en: "Edamame" }],
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await batchTranslateMenu("restaurant_01", "en");

      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "batchTranslateMenu"
      );
      expect(mockFunction).toHaveBeenCalledWith({
        restaurantId: "restaurant_01",
        targetLang: "en",
        generateBothModes: false,
      });
      expect(result).toEqual(mockResult.data);
    });

    test("一括翻訳エラー時に例外をスローする", async () => {
      const mockError = new Error("Batch translation failed");
      const mockFunction = jest.fn().mockRejectedValue(mockError);
      httpsCallable.mockReturnValue(mockFunction);

      await expect(batchTranslateMenu("restaurant_01", "en")).rejects.toThrow(
        "Batch translation failed"
      );
      expect(handleError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({ function: "batchTranslateMenu" })
      );
    });
  });

  describe("createOrder", () => {
    test("注文を正しく作成する", async () => {
      const mockOrderData = {
        restaurantId: "restaurant_01",
        tableId: "table_01",
        items: [{ id: "item_01", quantity: 2 }],
        total: 1000,
      };

      const mockResult = {
        data: {
          orderId: "order_123",
          orderNumber: "001",
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await createOrder(mockOrderData);

      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "createOrder"
      );
      expect(mockFunction).toHaveBeenCalledWith(mockOrderData);
      expect(result).toEqual(mockResult.data);
      expect(result.orderId).toBe("order_123");
      expect(result.orderNumber).toBe("001");
    });

    test("注文作成エラー時に例外をスローする", async () => {
      const mockError = new Error("Order creation failed");
      const mockFunction = jest.fn().mockRejectedValue(mockError);
      httpsCallable.mockReturnValue(mockFunction);

      await expect(createOrder({})).rejects.toThrow("Order creation failed");
      expect(handleError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({ function: "createOrder" })
      );
    });
  });

  describe("updateOrderStatus", () => {
    test("注文ステータスを正しく更新する", async () => {
      const mockResult = {
        data: {
          success: true,
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await updateOrderStatus("order_123", "confirmed");

      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "updateOrderStatus"
      );
      expect(mockFunction).toHaveBeenCalledWith({
        orderId: "order_123",
        newStatus: "confirmed",
      });
      expect(result.success).toBe(true);
    });

    test("ステータス更新エラー時に例外をスローする", async () => {
      const mockError = new Error("Status update failed");
      const mockFunction = jest.fn().mockRejectedValue(mockError);
      httpsCallable.mockReturnValue(mockFunction);

      await expect(updateOrderStatus("order_123", "confirmed")).rejects.toThrow(
        "Status update failed"
      );
      expect(handleError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({ function: "updateOrderStatus" })
      );
    });
  });

  describe("getMenuWithTranslation", () => {
    test("メニューを正しく取得する", async () => {
      const mockResult = {
        data: {
          categories: [{ id: "cat_01", name_ja: "前菜" }],
          items: [{ id: "item_01", name_ja: "枝豆" }],
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await getMenuWithTranslation("restaurant_01", "ja");

      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "getMenuWithTranslation"
      );
      expect(mockFunction).toHaveBeenCalledWith({
        restaurantId: "restaurant_01",
        language: "ja",
      });
      expect(result).toEqual(mockResult.data);
      expect(result.categories).toHaveLength(1);
      expect(result.items).toHaveLength(1);
    });

    test("英語メニューを取得する", async () => {
      const mockResult = {
        data: {
          categories: [{ id: "cat_01", name_en: "Appetizer" }],
          items: [{ id: "item_01", name_en: "Edamame" }],
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await getMenuWithTranslation("restaurant_01", "en");

      expect(mockFunction).toHaveBeenCalledWith({
        restaurantId: "restaurant_01",
        language: "en",
      });
      expect(result.categories[0].name_en).toBe("Appetizer");
    });

    test("メニュー取得エラー時に例外をスローする", async () => {
      const mockError = new Error("Network error");
      const mockFunction = jest.fn().mockRejectedValue(mockError);
      httpsCallable.mockReturnValue(mockFunction);

      await expect(
        getMenuWithTranslation("restaurant_01", "ja")
      ).rejects.toThrow("Network error");
      expect(handleError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({ function: "getMenuWithTranslation" })
      );
    });

    test("空のメニューを取得する", async () => {
      const mockResult = {
        data: {
          categories: [],
          items: [],
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await getMenuWithTranslation("restaurant_01", "ja");

      expect(result.categories).toHaveLength(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe("validateQRCode", () => {
    test("有効なQRコードを検証する", async () => {
      const mockResult = {
        data: {
          valid: true,
          restaurant: { id: "restaurant_01", name: "テストレストラン" },
          table: { id: "table_01", table_number: "1" },
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await validateQRCode("restaurant_01/table_01");

      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "validateQRCode"
      );
      expect(mockFunction).toHaveBeenCalledWith({
        qrData: "restaurant_01/table_01",
      });
      expect(result.valid).toBe(true);
      expect(result.restaurant.id).toBe("restaurant_01");
      expect(result.table.id).toBe("table_01");
    });

    test("無効なQRコードを検証する", async () => {
      const mockResult = {
        data: {
          valid: false,
        },
      };

      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      httpsCallable.mockReturnValue(mockFunction);

      const result = await validateQRCode("invalid_data");

      expect(result.valid).toBe(false);
      expect(result.restaurant).toBeUndefined();
      expect(result.table).toBeUndefined();
    });

    test("QRコード検証エラー時に例外をスローする", async () => {
      const mockError = new Error("Validation failed");
      const mockFunction = jest.fn().mockRejectedValue(mockError);
      httpsCallable.mockReturnValue(mockFunction);

      await expect(validateQRCode("test_data")).rejects.toThrow(
        "Validation failed"
      );
      expect(handleError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({ function: "validateQRCode" })
      );
    });
  });

  describe("Network error handling", () => {
    test("タイムアウトエラーを処理する", async () => {
      const mockError = new Error("Timeout");
      const mockFunction = jest.fn().mockRejectedValue(mockError);
      httpsCallable.mockReturnValue(mockFunction);

      await expect(
        getMenuWithTranslation("restaurant_01", "ja")
      ).rejects.toThrow("Timeout");
    });

    test("認証エラーを処理する", async () => {
      const mockError = new Error("Unauthenticated");
      const mockFunction = jest.fn().mockRejectedValue(mockError);
      httpsCallable.mockReturnValue(mockFunction);

      await expect(createOrder({})).rejects.toThrow("Unauthenticated");
    });

    test("権限エラーを処理する", async () => {
      const mockError = new Error("Permission denied");
      const mockFunction = jest.fn().mockRejectedValue(mockError);
      httpsCallable.mockReturnValue(mockFunction);

      await expect(updateOrderStatus("order_123", "confirmed")).rejects.toThrow(
        "Permission denied"
      );
    });
  });
});
