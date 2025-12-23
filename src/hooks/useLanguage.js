// 言語設定用カスタムフック
import {
  useState,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from "react";
import { LANGUAGES, DEFAULT_LANGUAGE } from "../constants";

// 言語コンテキスト
const LanguageContext = createContext(null);

/**
 * 言語プロバイダー
 */
export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);

  // 言語を変更
  const changeLanguage = useCallback((langCode) => {
    if (LANGUAGES[langCode]) {
      setCurrentLanguage(langCode);
    }
  }, []);

  // 現在の言語情報
  const languageInfo = useMemo(() => {
    return LANGUAGES[currentLanguage] || LANGUAGES[DEFAULT_LANGUAGE];
  }, [currentLanguage]);

  // テキストを取得（多言語対応オブジェクトから）
  const getText = useCallback(
    (textObj, fallbackKey = "ja") => {
      if (typeof textObj === "string") return textObj;
      if (!textObj) return "";

      // 現在の言語のテキストがあればそれを返す
      if (textObj[currentLanguage]) return textObj[currentLanguage];

      // なければ日本語を返す
      if (textObj[fallbackKey]) return textObj[fallbackKey];

      // どちらもなければ最初に見つかった値を返す
      const values = Object.values(textObj);
      return values.length > 0 ? values[0] : "";
    },
    [currentLanguage]
  );

  // メニュー項目の表示名を取得
  const getItemName = useCallback(
    (item) => {
      const key = `name_${currentLanguage}`;
      return item[key] || item.name_ja || item.name || "";
    },
    [currentLanguage]
  );

  // メニュー項目の説明を取得
  const getItemDescription = useCallback(
    (item) => {
      const key = `description_${currentLanguage}`;
      return item[key] || item.description_ja || item.description || "";
    },
    [currentLanguage]
  );

  // カテゴリ名を取得
  const getCategoryName = useCallback(
    (category) => {
      const key = `name_${currentLanguage}`;
      return category[key] || category.name_ja || category.name || "";
    },
    [currentLanguage]
  );

  const value = {
    currentLanguage,
    languageInfo,
    changeLanguage,
    getText,
    getItemName,
    getItemDescription,
    getCategoryName,
    availableLanguages: Object.values(LANGUAGES),
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * 言語フック
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export default useLanguage;
