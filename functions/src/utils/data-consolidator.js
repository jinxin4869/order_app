/**
 * データ統合ユーティリティ
 *
 * 料理データ.csv と 料理法.csv を統合し、
 * Firestoreに適した形式に変換します
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

/**
 * CSVファイルを読み込んでパースする
 * @param {string} filePath - CSVファイルのパス
 * @return {Promise<Array>} - パースされたデータ配列
 */
const parseCSV = async (filePath) => {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const rows = [];
  let headers = null;

  for await (const line of rl) {
    if (!line.trim()) continue;

    // CSVの解析（カンマ区切り、引用符考慮）
    const values = parseCSVLine(line);

    if (!headers) {
      headers = values;
    } else {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }
  }

  return rows;
};

/**
 * CSV行を解析（引用符とカンマを考慮）
 * @param {string} line - CSV行
 * @return {Array} - パースされた値の配列
 */
const parseCSVLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

/**
 * 料理データ.csv を統合フォーマットに変換
 * @param {Array} rows - CSVのデータ行
 * @return {Array} - 統合フォーマットのデータ
 */
const convertDishData = (rows) => {
  return rows.map((row) => {
    return {
      id: row.id || "",
      term_ja: row.term_ja || "",
      reading: row.reading || "",
      term_en: row.term_en || "",
      term_zh: row.term_zh || "",
      category: row.category || "dish",
      subcategory: row.subcategory || "",
      priority: parseInt(row.priority) || 999,
      notes: row.notes || "",
      type: "dish_name", // データタイプを追加
    };
  });
};

/**
 * 料理法.csv を統合フォーマットに変換
 * @param {Array} rows - CSVのデータ行
 * @return {Array} - 統合フォーマットのデータ
 */
const convertCookingMethodData = (rows) => {
  const converted = [];

  rows.forEach((row, index) => {
    const category = row.Category || "unknown";

    // 日本語、英語、中国語の各列を処理
    const jaKey = Object.keys(row).find((key) => key.includes("Japanese"));
    const enKey = Object.keys(row).find((key) => key.includes("English"));
    const zhKey = Object.keys(row).find(
      (key) => key.includes("Chinese") || key.includes("simplified")
    );

    const termJa = row[jaKey] || "";
    const termEn = row[enKey] || "";
    const termZh = row[zhKey] || "";

    if (termJa) {
      converted.push({
        id: `method_${index + 1}`,
        term_ja: termJa,
        reading: "", // 料理法CSVには読み仮名がない
        term_en: termEn,
        term_zh: termZh,
        category: category.toLowerCase().replace(/\s+/g, "_"),
        subcategory: "",
        priority: getCategoryPriority(category),
        notes: "",
        type: getCategoryType(category),
      });
    }
  });

  return converted;
};

/**
 * カテゴリに基づいて優先度を決定
 * @param {string} category - カテゴリ名
 * @return {number} - 優先度
 */
const getCategoryPriority = (category) => {
  const priorityMap = {
    cooking_method: 100,
    dish_type: 200,
    course_category: 300,
    course_order: 400,
  };

  return priorityMap[category.toLowerCase().replace(/\s+/g, "_")] || 999;
};

/**
 * カテゴリに基づいてタイプを決定
 * @param {string} category - カテゴリ名
 * @return {string} - タイプ
 */
const getCategoryType = (category) => {
  const normalized = category.toLowerCase().replace(/\s+/g, "_");

  const typeMap = {
    cooking_method: "cooking_method",
    dish_type: "dish_type",
    course_category: "course",
    course_order: "course",
  };

  return typeMap[normalized] || "other";
};

/**
 * データを統合して重複を削除
 * @param {Array} dishData - 料理データ
 * @param {Array} cookingMethodData - 料理法データ
 * @return {Array} - 統合されたデータ
 */
const consolidateData = (dishData, cookingMethodData) => {
  const allData = [...dishData, ...cookingMethodData];

  // term_jaをキーに重複を削除（最初の出現を保持）
  const uniqueData = new Map();

  allData.forEach((item) => {
    if (item.term_ja && !uniqueData.has(item.term_ja)) {
      uniqueData.set(item.term_ja, item);
    }
  });

  // 優先度順にソート
  return Array.from(uniqueData.values()).sort(
    (a, b) => a.priority - b.priority
  );
};

/**
 * 統合データをFirestore形式のJSONに変換
 * @param {Array} data - 統合データ
 * @return {Object} - Firestore形式のデータ
 */
const toFirestoreFormat = (data) => {
  const firestoreData = {};

  data.forEach((item) => {
    // IDをFirestoreドキュメントIDとして使用
    const docId = item.id || `term_${Date.now()}_${Math.random()}`;

    firestoreData[docId] = {
      term_ja: item.term_ja,
      reading: item.reading,
      translations: {
        en: item.term_en,
        zh: item.term_zh,
      },
      category: item.category,
      subcategory: item.subcategory,
      priority: item.priority,
      type: item.type,
      notes: item.notes,
      updated_at: new Date().toISOString(),
    };
  });

  return firestoreData;
};

/**
 * メイン処理 - CSVファイルを統合してJSON出力
 * @param {Object} options - オプション
 * @return {Promise<Object>} - 統合結果
 */
const consolidate = async (options = {}) => {
  const {
    dishDataPath = path.join(__dirname, "../../../料理データ.csv"),
    cookingMethodPath = path.join(__dirname, "../../../料理法.csv"),
    outputPath = path.join(__dirname, "../../../consolidated_dictionary.json"),
  } = options;

  console.log("📖 CSVファイルを読み込んでいます...");

  // CSVファイルを読み込み
  const dishRows = await parseCSV(dishDataPath);
  const cookingRows = await parseCSV(cookingMethodPath);

  console.log(`料理データ: ${dishRows.length} 件`);
  console.log(`料理法データ: ${cookingRows.length} 件`);

  // データを変換
  const dishData = convertDishData(dishRows);
  const cookingMethodData = convertCookingMethodData(cookingRows);

  // データを統合
  const consolidatedData = consolidateData(dishData, cookingMethodData);

  console.log(`統合後: ${consolidatedData.length} 件（重複削除済み）`);

  // Firestore形式に変換
  const firestoreData = toFirestoreFormat(consolidatedData);

  // JSONファイルとして出力
  fs.writeFileSync(outputPath, JSON.stringify(firestoreData, null, 2), "utf8");

  console.log(`✅ 統合完了: ${outputPath}`);

  return {
    totalItems: consolidatedData.length,
    dishItems: dishData.length,
    cookingMethodItems: cookingMethodData.length,
    outputPath: outputPath,
    data: consolidatedData,
  };
};

module.exports = {
  parseCSV,
  convertDishData,
  convertCookingMethodData,
  consolidateData,
  toFirestoreFormat,
  consolidate,
};
