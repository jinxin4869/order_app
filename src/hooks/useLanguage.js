// 言語設定用カスタムフック
import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  createContext,
  useContext,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LANGUAGES, DEFAULT_LANGUAGE } from "../constants";

const LANGUAGE_STORAGE_KEY = "@qr_order_language";

// 言語コンテキスト
const LanguageContext = createContext(null);

/**
 * 言語プロバイダー
 */
export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  const [translationMode, setTranslationMode] = useState("dictionary"); // "dictionary" | "deepl_only"

  // 起動時に保存済み言語を復元
  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLang && LANGUAGES[savedLang]) {
          setCurrentLanguage(savedLang);
        }
      } catch (error) {
        console.warn("Failed to load saved language:", error);
      }
    };
    loadSavedLanguage();
  }, []);

  // 言語を変更
  const changeLanguage = useCallback(async (langCode) => {
    if (LANGUAGES[langCode]) {
      setCurrentLanguage(langCode);
      try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, langCode);
      } catch (error) {
        console.warn("Failed to save language:", error);
      }
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
      if (currentLanguage === "ja") {
        return item.name_ja || item.name || "";
      }
      if (translationMode === "deepl_only") {
        const nodicKey = `name_${currentLanguage}_nodic`;
        if (item[nodicKey]) return item[nodicKey];
      }
      const key = `name_${currentLanguage}`;
      return item[key] || item.name_ja || item.name || "";
    },
    [currentLanguage, translationMode]
  );

  // メニュー項目の説明を取得
  const getItemDescription = useCallback(
    (item) => {
      if (currentLanguage === "ja") {
        return item.description_ja || item.description || "";
      }
      if (translationMode === "deepl_only") {
        const nodicKey = `description_${currentLanguage}_nodic`;
        if (item[nodicKey]) return item[nodicKey];
      }
      const key = `description_${currentLanguage}`;
      return item[key] || item.description_ja || item.description || "";
    },
    [currentLanguage, translationMode]
  );

  // カテゴリ名を取得
  const getCategoryName = useCallback(
    (category) => {
      if (currentLanguage === "ja") {
        return category.name_ja || category.name || "";
      }
      if (translationMode === "deepl_only") {
        const nodicKey = `name_${currentLanguage}_nodic`;
        if (category[nodicKey]) return category[nodicKey];
      }
      const key = `name_${currentLanguage}`;
      return category[key] || category.name_ja || category.name || "";
    },
    [currentLanguage, translationMode]
  );

  const value = {
    currentLanguage,
    languageInfo,
    changeLanguage,
    translationMode,
    setTranslationMode,
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
