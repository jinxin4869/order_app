const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const os = require("node:os");
const root =
  process.env.ORDER_APP_WEB_DIR || path.join(os.tmpdir(), "order-app-web-test");
const artifacts = process.env.ORDER_APP_WEB_ARTIFACTS || os.tmpdir();
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req, res) => {
  let file = path.join(
    root,
    decodeURIComponent(new URL(req.url, "http://localhost").pathname)
  );
  if (!file.startsWith(root + "/")) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = path.join(root, "index.html");
  res.setHeader(
    "Content-Type",
    file.endsWith(".js")
      ? "application/javascript"
      : file.endsWith(".png")
        ? "image/png"
        : "text/html"
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const calls = [];
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "127.0.0.1") return route.continue();
        if (!url.hostname.endsWith("-demo-order-app.cloudfunctions.net"))
          return route.abort();
        if (route.request().method() === "OPTIONS")
          return route.fulfill({
            status: 204,
            headers: {
              "access-control-allow-origin": "*",
              "access-control-allow-headers": "*",
            },
          });
        const name = url.pathname.split("/").pop();
        const data = route.request().postDataJSON().data;
        calls.push({ name, data });
        let result;
        if (name === "validateQRCode") {
          const [restaurantId, tableId] = data.qrData.split("/");
          result = {
            valid: tableId !== "closed",
            error: tableId === "closed" ? "停止中のテーブルです。" : undefined,
            restaurant: {
              id: restaurantId,
              name: "テスト店舗",
              supported_languages: ["ja", "en", "zh"],
            },
            table: { id: tableId, table_number: "1", status: "available" },
          };
        } else if (name === "getMenuWithTranslation") {
          result = {
            restaurant: { name: "テスト店舗" },
            categories: [{ id: "test-category", name_ja: "料理" }],
            items: [
              {
                id: "test-item",
                category_id: "test-category",
                name_ja: "テスト料理",
                price: 1000,
                is_available: true,
                description_ja: "検証用の料理",
              },
            ],
          };
        } else if (name === "createOrder")
          result = {
            success: true,
            orderId: "test-order",
            orderNumber: "20261009-001",
          };
        else throw new Error("Unexpected callable " + name);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ data: result }),
        });
      });
      await page.goto(
        "http://127.0.0.1:4173/order?restaurant=rest-test&table=table-test"
      );
      await page.getByText("言語を選択してください", { exact: true }).waitFor();
      console.log("INITIAL", viewport.width, page.url());
      await page.reload();
      await page.getByText("言語を選択してください", { exact: true }).waitFor();
      console.log("RELOAD", viewport.width, page.url());
      await page.getByRole("button", { name: "日本語", exact: true }).click();
      await page.getByText("テスト料理", { exact: true }).click();
      await page.getByText("カートに追加", { exact: true }).click();
      await page.getByText("🛒 カートを見る", { exact: true }).click();
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.getByText("×", { exact: true }).click();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByText("×", { exact: true }).click();
      await page.getByText("カートは空です", { exact: true }).waitFor();
      await page.getByText("メニューに戻る", { exact: true }).click();
      await page.getByText("テスト料理", { exact: true }).click();
      await page.getByText("カートに追加", { exact: true }).click();
      await page.getByText("🛒 カートを見る", { exact: true }).click();
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.getByText("注文を確定する", { exact: true }).click();
      assert.equal(calls.filter((c) => c.name === "createOrder").length, 0);
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByText("注文を確定する", { exact: true }).click();
      await page.getByText("20261009-001", { exact: true }).waitFor();
      assert.equal(calls.filter((c) => c.name === "createOrder").length, 1);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      await page.screenshot({
        path: path.join(
          process.env.ORDER_APP_WEB_ARTIFACTS || os.tmpdir(),
          `order-app-web-${viewport.width}.png`
        ),
        fullPage: true,
      });
      console.log(
        "PASS",
        viewport.width,
        "QR reload and one order",
        calls.filter((c) => c.name === "createOrder")[0].data.requestId
      );
      await page.goto("http://127.0.0.1:4173/order?restaurant=rest-test");
      await page
        .getByText(
          "無効なテーブルURLです。 / Invalid table link. / 餐桌链接无效。",
          { exact: true }
        )
        .waitFor();
      await page.goto(
        "http://127.0.0.1:4173/order?restaurant=rest-test&table=closed"
      );
      await page.getByText("停止中のテーブルです。", { exact: true }).waitFor();
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
