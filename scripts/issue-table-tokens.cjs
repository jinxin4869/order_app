#!/usr/bin/env node
// テーブルのQRトークンを発行（再発行）し、印刷用のQRのURLをCSVで出力する。
// 保存するのはハッシュだけ。CSVにはトークンが含まれるため、コミットせず、
// 印刷が終わったら削除する。手順は docs/table_tokens.md。
//
//   エミュレーター: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/issue-table-tokens.cjs \
//     --project demo-order-app --restaurant rest-test --origin https://example.web.app --out tokens.csv
//   本番: 管理者の Admin SDK 環境で --project <project-id> --yes を付けて実行する。
const { writeFileSync } = require("node:fs");
const { parseArgs } = require("node:util");
const { createRequire } = require("node:module");
const functionsRequire = createRequire(
  require.resolve("../functions/package.json")
);
const { initializeApp, deleteApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");
const { issueTableTokens } = require("../functions/src/utils/tableToken");

const { values: args } = parseArgs({
  options: {
    project: { type: "string" },
    restaurant: { type: "string" },
    origin: { type: "string" },
    out: { type: "string" },
    tables: { type: "string" },
    yes: { type: "boolean", default: false },
  },
});
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!args.project || !args.restaurant || !args.origin || !args.out)
  fail(
    "Usage: --project <id> --restaurant <id> --origin <https://host> --out <file.csv> [--tables t1,t2] [--yes]"
  );
const emulator = /^(127\.0\.0\.1|localhost):\d+$/.test(
  process.env.FIRESTORE_EMULATOR_HOST || ""
);
if (!emulator && !args.yes)
  fail(
    "Not connected to the Firestore emulator. Add --yes to change the real project's tokens (old QR codes stop working once enforcement is on)."
  );
const origin = new URL(args.origin);
if (!["https:", "http:"].includes(origin.protocol))
  fail("--origin must be an http(s) URL");

(async () => {
  const app = initializeApp({ projectId: args.project });
  try {
    const db = getFirestore(app);
    const tableIds = args.tables
      ? args.tables.split(",").filter(Boolean)
      : (
          await db
            .collection("restaurants")
            .doc(args.restaurant)
            .collection("tables")
            .get()
        ).docs.map((doc) => doc.id);
    const issued = await issueTableTokens(db, args.restaurant, tableIds);
    const rows = issued.map(({ tableId, tableNumber, token }) => {
      const url = new URL("/order", origin);
      url.searchParams.set("restaurant", args.restaurant);
      url.searchParams.set("table", tableId);
      url.searchParams.set("token", token);
      return [tableId, tableNumber, url.toString()]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",");
    });
    writeFileSync(
      args.out,
      ["table_id,table_number,qr_url", ...rows].join("\n") + "\n",
      {
        mode: 0o600,
      }
    );
    console.log(
      `Issued ${issued.length} table tokens. Wrote ${args.out} (contains secrets; do not commit).`
    );
  } finally {
    await deleteApp(app);
  }
})().catch((error) => fail(error.message));
