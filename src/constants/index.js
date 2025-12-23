// アプリ全体で使用する定数

// サポートする言語
export const LANGUAGES = {
  ja: {
    code: "ja",
    name: "日本語",
    nativeName: "日本語",
    flag: "🇯🇵",
  },
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
  },
  zh: {
    code: "zh",
    name: "Chinese",
    nativeName: "中文",
    flag: "🇨🇳",
  },
};

// デフォルト言語
export const DEFAULT_LANGUAGE = "ja";

// 注文ステータス
export const ORDER_STATUS = {
  PENDING: "pending", // 未確認
  CONFIRMED: "confirmed", // 確認済み
  PREPARING: "preparing", // 調理中
  READY: "ready", // 提供準備完了
  SERVED: "served", // 提供済み
  COMPLETED: "completed", // 完了
  CANCELLED: "cancelled", // キャンセル
};

// アレルゲン情報
export const ALLERGENS = {
  wheat: { ja: "小麦", en: "Wheat", zh: "小麦", icon: "🌾" },
  egg: { ja: "卵", en: "Egg", zh: "鸡蛋", icon: "🥚" },
  milk: { ja: "乳", en: "Milk", zh: "牛奶", icon: "🥛" },
  peanut: { ja: "ピーナッツ", en: "Peanut", zh: "花生", icon: "🥜" },
  shrimp: { ja: "エビ", en: "Shrimp", zh: "虾", icon: "🦐" },
  crab: { ja: "カニ", en: "Crab", zh: "蟹", icon: "🦀" },
  soba: { ja: "そば", en: "Buckwheat", zh: "荞麦", icon: "🍜" },
  soy: { ja: "大豆", en: "Soybean", zh: "大豆", icon: "🫘" },
  sesame: { ja: "ゴマ", en: "Sesame", zh: "芝麻", icon: "⚪" },
  fish: { ja: "魚", en: "Fish", zh: "鱼", icon: "🐟" },
};

// カラーテーマ
export const COLORS = {
  primary: "#E53935", // 和風の赤
  secondary: "#FF8A80",
  background: "#FFF8F0", // 温かみのある白
  surface: "#FFFFFF",
  text: "#333333",
  textSecondary: "#666666",
  border: "#E0E0E0",
  success: "#4CAF50",
  warning: "#FF9800",
  error: "#F44336",
  disabled: "#BDBDBD",
};

// フォントサイズ
export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  title: 28,
};

// 消費税率
export const TAX_RATE = 0.1;
