#!/usr/bin/env node

/**
 * データ統合スクリプト
 *
 * 料理データ.csv と 料理法.csv を統合し、
 * consolidated_dictionary.json を生成します
 *
 * 使用方法:
 *   node scripts/consolidate-data.js
 */

const path = require("path");
const consolidator = require("../src/utils/data-consolidator");

console.log("📖 データ統合スクリプトを開始します...\n");

// デフォルトのパス設定
const dishDataPath = path.join(__dirname, "../../料理データ.csv");
const cookingMethodPath = path.join(__dirname, "../../料理法.csv");
const outputPath = path.join(__dirname, "../../consolidated_dictionary.json");

consolidator
    .consolidate({
      dishDataPath,
      cookingMethodPath,
      outputPath,
    })
    .then((result) => {
      console.log("\n✅ データ統合が完了しました！");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`📊 統計情報:`);
      console.log(`   総アイテム数: ${result.totalItems} 件`);
      console.log(`   - 料理データ: ${result.dishItems} 件`);
      console.log(`   - 料理法データ: ${result.cookingMethodItems} 件`);
      console.log(`   - 重複削除: ${result.dishItems + result.cookingMethodItems - result.totalItems} 件`);
      console.log(`\n📄 出力ファイル: ${result.outputPath}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      // サンプルデータを表示
      console.log("📝 サンプルデータ（最初の3件）:");
      result.data.slice(0, 3).forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.term_ja} (${item.reading || "読み仮名なし"})`);
        console.log(`   英語: ${item.term_en}`);
        console.log(`   中国語: ${item.term_zh}`);
        console.log(`   カテゴリ: ${item.category} / タイプ: ${item.type}`);
        console.log(`   優先度: ${item.priority}`);
      });

      console.log("\n✨ 次のステップ:");
      console.log("   1. consolidated_dictionary.json を確認");
      console.log("   2. Firestoreにインポート（scripts/import-dictionary.js を作成）");
      console.log("   3. 翻訳システムで動作確認\n");
    })
    .catch((error) => {
      console.error("\n❌ エラーが発生しました:");
      console.error(error.message);

      if (error.code === "ENOENT") {
        console.error("\n💡 ヒント: CSVファイルが見つかりません。");
        console.error("   以下のファイルが存在することを確認してください:");
        console.error(`   - ${dishDataPath}`);
        console.error(`   - ${cookingMethodPath}`);
      }

      process.exit(1);
    });
