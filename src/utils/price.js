// 金額の計算はサーバーと同じ規則（functions/src/utils/orderTotals.js）を使う。
// ここにあるのは表示の書式だけで、税率や端数処理は持たない。
import { taxIncluded, totalsOf } from "../../functions/src/utils/orderTotals";

export { taxIncluded, totalsOf };

export const yen = (value) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;

const TAX_LABEL = { ja: "（税込）", en: " (incl. tax)", zh: "（含税）" };
export const taxLabel = (language) => TAX_LABEL[language] || TAX_LABEL.ja;

// メニューに出す税込の単価。価格が未設定の商品（注文はサーバーが拒否する）は空。
export const menuPrice = (price, language) =>
  Number.isSafeInteger(price) && price >= 0
    ? `${yen(taxIncluded(price))}${taxLabel(language)}`
    : "";
