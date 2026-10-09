/**
 * useLanguageのテスト
 */

import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { LanguageProvider, useLanguage } from "../useLanguage";
import { LANGUAGES, DEFAULT_LANGUAGE } from "../../constants";

const verified = (field, sourceText) =>
  Object.fromEntries(
    ["en", "zh"].flatMap((lang) =>
      ["dictionary", "deepl_only"].map((mode) => [
        `${field}_${lang}${mode === "deepl_only" ? "_nodic" : ""}_translation`,
        {
          schemaVersion: 1,
          sourceText,
          mode,
          status: "ready",
          usedDictionary: mode === "dictionary",
          method: mode === "dictionary" ? "hybrid" : "deepl_only",
        },
      ])
    )
  );

describe("useLanguage", () => {
  const wrapper = ({ children }) => (
    <LanguageProvider>{children}</LanguageProvider>
  );

  test("デフォルト言語は日本語", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.currentLanguage).toBe(DEFAULT_LANGUAGE);
    expect(result.current.currentLanguage).toBe("ja");
  });

  test("言語情報を正しく取得する", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.languageInfo).toEqual(LANGUAGES.ja);
    expect(result.current.languageInfo.code).toBe("ja");
    expect(result.current.languageInfo.name).toBe("日本語");
    expect(result.current.languageInfo.flag).toBe("🇯🇵");
  });

  test("利用可能な言語リストを取得する", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.availableLanguages).toHaveLength(3);
    expect(result.current.availableLanguages).toContainEqual(LANGUAGES.ja);
    expect(result.current.availableLanguages).toContainEqual(LANGUAGES.en);
    expect(result.current.availableLanguages).toContainEqual(LANGUAGES.zh);
  });

  test("changeLanguageで言語を変更できる", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.changeLanguage("en");
    });

    expect(result.current.currentLanguage).toBe("en");
    expect(result.current.languageInfo).toEqual(LANGUAGES.en);
  });

  test("無効な言語コードでは変更されない", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.changeLanguage("invalid");
    });

    expect(result.current.currentLanguage).toBe("ja");
  });

  test("getTextで多言語テキストを取得する", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const textObj = {
      ja: "こんにちは",
      en: "Hello",
      zh: "你好",
    };

    expect(result.current.getText(textObj)).toBe("こんにちは");

    act(() => {
      result.current.changeLanguage("en");
    });

    expect(result.current.getText(textObj)).toBe("Hello");

    act(() => {
      result.current.changeLanguage("zh");
    });

    expect(result.current.getText(textObj)).toBe("你好");
  });

  test("getTextで文字列が渡された場合はそのまま返す", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.getText("直接テキスト")).toBe("直接テキスト");
  });

  test("getTextでnullやundefinedが渡された場合は空文字を返す", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.getText(null)).toBe("");
    expect(result.current.getText(undefined)).toBe("");
  });

  test("getTextで現在の言語がない場合はフォールバックを返す", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const textObj = {
      ja: "日本語",
      en: "English",
    };

    act(() => {
      result.current.changeLanguage("zh");
    });

    // 中国語がない場合、日本語にフォールバック
    expect(result.current.getText(textObj)).toBe("日本語");
  });

  test("getItemNameでメニュー項目名を取得する", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const item = {
      name_ja: "枝豆",
      ...verified("name", "枝豆"),
      name_en: "Edamame",
      name_zh: "毛豆",
    };

    expect(result.current.getItemName(item)).toBe("枝豆");

    act(() => {
      result.current.changeLanguage("en");
    });

    expect(result.current.getItemName(item)).toBe("Edamame");

    act(() => {
      result.current.changeLanguage("zh");
    });

    expect(result.current.getItemName(item)).toBe("毛豆");
  });

  test("getItemNameで現在の言語がない場合は日本語にフォールバック", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const item = {
      name_ja: "枝豆",
      ...verified("name", "枝豆"),
      name_en: "Edamame",
    };

    act(() => {
      result.current.changeLanguage("zh");
    });

    expect(result.current.getItemName(item)).toBe(
      "枝豆 [未生成翻译；日文原文]"
    );
  });

  test("getItemNameでname_jaもない場合はnameにフォールバック", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const item = {
      name: "フォールバック名",
    };

    expect(result.current.getItemName(item)).toBe("フォールバック名");
  });

  test("getItemDescriptionで説明文を取得する", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const item = {
      description_ja: "塩茹でした枝豆",
      ...verified("description", "塩茹でした枝豆"),
      description_en: "Salted boiled soybeans",
      description_zh: "盐水煮毛豆",
    };

    expect(result.current.getItemDescription(item)).toBe("塩茹でした枝豆");

    act(() => {
      result.current.changeLanguage("en");
    });

    expect(result.current.getItemDescription(item)).toBe(
      "Salted boiled soybeans"
    );

    act(() => {
      result.current.changeLanguage("zh");
    });

    expect(result.current.getItemDescription(item)).toBe("盐水煮毛豆");
  });

  test("getItemDescriptionで現在の言語がない場合は日本語にフォールバック", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const item = {
      description_ja: "塩茹でした枝豆",
      ...verified("description", "塩茹でした枝豆"),
      description_en: "Salted boiled soybeans",
    };

    act(() => {
      result.current.changeLanguage("zh");
    });

    expect(result.current.getItemDescription(item)).toBe(
      "塩茹でした枝豆 [未生成翻译；日文原文]"
    );
  });

  test("getCategoryNameでカテゴリ名を取得する", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const category = {
      name_ja: "前菜",
      ...verified("name", "前菜"),
      name_en: "Appetizer",
      name_zh: "开胃菜",
    };

    expect(result.current.getCategoryName(category)).toBe("前菜");

    act(() => {
      result.current.changeLanguage("en");
    });

    expect(result.current.getCategoryName(category)).toBe("Appetizer");

    act(() => {
      result.current.changeLanguage("zh");
    });

    expect(result.current.getCategoryName(category)).toBe("开胃菜");
  });

  test("getCategoryNameで現在の言語がない場合は日本語にフォールバック", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const category = {
      name_ja: "前菜",
      ...verified("name", "前菜"),
      name_en: "Appetizer",
    };

    act(() => {
      result.current.changeLanguage("zh");
    });

    expect(result.current.getCategoryName(category)).toBe(
      "前菜 [未生成翻译；日文原文]"
    );
  });

  test("LanguageProviderなしでuseLanguageを使うとエラー", () => {
    // エラーをキャッチするためにconsole.errorをモック
    const consoleError = console.error;
    console.error = jest.fn();

    expect(() => {
      renderHook(() => useLanguage());
    }).toThrow("useLanguage must be used within a LanguageProvider");

    console.error = consoleError;
  });

  test("翻訳モードのデフォルトはdictionary", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.translationMode).toBe("dictionary");
  });

  test("setTranslationModeで翻訳モードを切り替えられる", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setTranslationMode("deepl_only");
    });

    expect(result.current.translationMode).toBe("deepl_only");
  });

  test("deepl_onlyモードではgetItemNameが_nodicフィールドを優先する", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const item = {
      name_ja: "枝豆",
      ...verified("name", "枝豆"),
      name_en: "Edamame (dict)",
      name_zh: "毛豆 (dict)",
      name_en_nodic: "Green soybeans",
      name_zh_nodic: "青大豆",
    };

    act(() => {
      result.current.changeLanguage("en");
      result.current.setTranslationMode("deepl_only");
    });

    expect(result.current.getItemName(item)).toBe("Green soybeans");
  });

  test("deepl_onlyモードでも日本語は影響を受けない", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const item = {
      name_ja: "枝豆",
      ...verified("name", "枝豆"),
      name_en: "Edamame",
      name_en_nodic: "Green soybeans",
    };

    act(() => {
      result.current.setTranslationMode("deepl_only");
    });

    expect(result.current.getItemName(item)).toBe("枝豆");
  });

  test("deepl_onlyモードで_nodicフィールドがない場合は日本語と未生成表示", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const item = {
      name_ja: "枝豆",
      ...verified("name", "枝豆"),
      name_en: "Edamame",
    };

    act(() => {
      result.current.changeLanguage("en");
      result.current.setTranslationMode("deepl_only");
    });

    expect(result.current.getItemName(item)).toBe(
      "枝豆 [Translation unavailable; Japanese original]"
    );
  });

  test("dictionaryモードでは_nodicフィールドを使用しない", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    const item = {
      name_ja: "枝豆",
      ...verified("name", "枝豆"),
      name_en: "Edamame (dict)",
      name_en_nodic: "Green soybeans",
    };

    act(() => {
      result.current.changeLanguage("en");
    });

    expect(result.current.getItemName(item)).toBe("Edamame (dict)");
  });

  test("複数回言語を切り替えても正しく動作する", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.currentLanguage).toBe("ja");

    act(() => {
      result.current.changeLanguage("en");
    });
    expect(result.current.currentLanguage).toBe("en");

    act(() => {
      result.current.changeLanguage("zh");
    });
    expect(result.current.currentLanguage).toBe("zh");

    act(() => {
      result.current.changeLanguage("ja");
    });
    expect(result.current.currentLanguage).toBe("ja");
  });
});
