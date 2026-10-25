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
// Serve with the production Hosting headers so CSP violations surface here.
const hostingHeaders = require("../firebase.json").hosting.headers.find(
  (rule) => rule.source === "**"
).headers;
const csp = hostingHeaders.find(
  (header) => header.key === "Content-Security-Policy-Report-Only"
).value;
// expo-camera fetches the zxing wasm from a versioned CDN path when the
// browser lacks BarcodeDetector; the CSP must allow exactly that version.
const jsDir = path.join(root, "_expo/static/js/web");
for (const file of fs.readdirSync(jsDir))
  for (const [cdn] of fs
    .readFileSync(path.join(jsDir, file), "utf8")
    .matchAll(/https:\/\/fastly\.jsdelivr\.net\/npm\/[^/"'`]+\//g))
    assert.ok(csp.includes(cdn), `CSP connect-src is missing ${cdn}`);
const server = http.createServer((req, res) => {
  for (const { key, value } of hostingHeaders) res.setHeader(key, value);
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
      const cspViolations = [];
      await page.exposeFunction("__reportCsp", (v) => cspViolations.push(v));
      await page.addInitScript(() =>
        document.addEventListener("securitypolicyviolation", (e) =>
          window.__reportCsp(`${e.effectiveDirective} ${e.blockedURI}`)
        )
      );
      const calls = [];
      // Requests the synthetic server accepted; set to simulate lost responses.
      const acceptedOrders = new Map();
      let loseOrderResponses = false;
      let staffStatus = "pending";
      // Synthetic menu state shared by the staff menu and customer screens.
      let soldOutIds = [];
      let itemVersion = 0;
      let staffUpdates = 0;
      const staffOrder = () => ({
        id: "staff-order",
        order_number: "20261009-002",
        table_number: "2",
        status: staffStatus,
        total_amount: 1100,
        created_at: Date.now(),
        customer_language: "ja",
        items: [
          {
            name_ja: "スタッフ検証料理",
            quantity: 1,
            price: 1000,
            notes: "ねぎ抜き",
          },
        ],
      });
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        aud: "demo-order-app",
        iss: "https://securetoken.google.com/demo-order-app",
        sub: "staff-test",
        user_id: "staff-test",
        iat: now,
        auth_time: now,
        exp: now + 3600,
        role: "staff",
        restaurantId: "rest-test",
        firebase: { sign_in_provider: "password" },
      };
      const token = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.synthetic`;
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "127.0.0.1") return route.continue();
        if (url.hostname === "identitytoolkit.googleapis.com") {
          if (route.request().method() === "OPTIONS")
            return route.fulfill({
              status: 204,
              headers: {
                "access-control-allow-origin": "*",
                "access-control-allow-headers": "*",
              },
            });
          const data = url.pathname.endsWith("accounts:signInWithPassword")
            ? {
                localId: "staff-test",
                email: "staff@example.invalid",
                idToken: token,
                refreshToken: "synthetic-refresh",
                expiresIn: "3600",
                registered: true,
              }
            : {
                users: [
                  {
                    localId: "staff-test",
                    email: "staff@example.invalid",
                    emailVerified: true,
                    providerUserInfo: [
                      {
                        providerId: "password",
                        rawId: "staff@example.invalid",
                        email: "staff@example.invalid",
                      },
                    ],
                  },
                ],
              };
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify(data),
          });
        }
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
            categories: [
              { id: "test-category", name_ja: "料理" },
              { id: "drinks", name_ja: "飲み物" },
            ],
            items: [
              {
                id: "test-item",
                category_id: "test-category",
                name_ja: "テスト料理",
                name_en: "Test dish (dictionary)",
                name_en_translation: {
                  schemaVersion: 1,
                  sourceText: "テスト料理",
                  mode: "dictionary",
                  status: "ready",
                  method: "hybrid",
                  usedDictionary: true,
                },
                price: 1000,
                is_available: true,
                description_ja: "検証用の料理",
              },
              {
                id: "tea",
                category_id: "drinks",
                name_ja: "お茶",
                price: 200,
                is_available: true,
              },
            ],
          };
        } else if (name === "createOrder") {
          result = acceptedOrders.get(data.requestId) || {
            success: true,
            orderId: loseOrderResponses ? "lost-order" : "test-order",
            orderNumber: loseOrderResponses ? "20261009-003" : "20261009-001",
          };
          acceptedOrders.set(data.requestId, {
            ...result,
            visitId: data.visitId,
            total: data.totalAmount,
          });
          if (loseOrderResponses) return route.abort("failed");
        } else if (name === "getMenuAvailability") {
          result = { ordering: "open", soldOut: soldOutIds };
        } else if (name === "listVisitOrders") {
          result = {
            closed: false,
            orders: [...acceptedOrders.values()]
              .filter((saved) => saved.visitId === data.visitId)
              .map((saved) => ({
                id: saved.orderId,
                order_number: saved.orderNumber,
                status: "pending",
                total_amount: saved.total,
                created_at: Date.now(),
                items: [{ name_ja: "テスト料理", quantity: 1 }],
              })),
          };
        } else if (name === "getOrderRequest") {
          const saved = acceptedOrders.get(data.requestId);
          result = saved
            ? {
                accepted: true,
                orderId: saved.orderId,
                orderNumber: saved.orderNumber,
              }
            : { accepted: false };
        } else if (
          [
            "listStaffOrders",
            "getStaffOrder",
            "updateOrderStatus",
            "getStaffMenu",
            "setMenuItemAvailability",
          ].includes(name)
        ) {
          assert.ok(
            route.request().headers().authorization?.startsWith("Bearer ")
          );
          if (name === "getStaffMenu")
            result = {
              restaurant: { name: "テスト店舗", ordering: "open", version: 0 },
              categories: [{ id: "test-category", name_ja: "料理" }],
              items: [
                {
                  id: "test-item",
                  category_id: "test-category",
                  name_ja: "テスト料理",
                  price: 1000,
                  available: !soldOutIds.includes("test-item"),
                  version: itemVersion,
                },
              ],
            };
          else if (name === "setMenuItemAvailability") {
            assert.equal(data.expectedVersion, itemVersion);
            itemVersion++;
            soldOutIds = data.available ? [] : [data.itemId];
            result = {
              success: true,
              available: data.available,
              version: itemVersion,
            };
          } else if (name === "listStaffOrders")
            result = {
              restaurantId: "rest-test",
              orders: [staffOrder()],
              cursor: "staff-order",
              hasMore: false,
            };
          else if (name === "getStaffOrder") result = { order: staffOrder() };
          else {
            staffUpdates++;
            if (staffUpdates === 1) {
              assert.equal(data.expectedStatus, "pending");
              staffStatus = data.newStatus;
              result = { success: true, status: staffStatus };
            } else {
              staffStatus = "ready";
              return route.fulfill({
                status: 409,
                contentType: "application/json",
                headers: { "access-control-allow-origin": "*" },
                body: JSON.stringify({
                  error: {
                    status: "ABORTED",
                    message: "Synthetic concurrent update",
                    details: { reason: "status_changed" },
                  },
                }),
              });
            }
          }
        } else throw new Error("Unexpected callable " + name);
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
      await page.getByText("飲み物", { exact: true }).click();
      await page.getByText("お茶", { exact: true }).waitFor();
      assert.equal(
        calls.filter((call) => call.name === "getMenuWithTranslation").length,
        1
      );
      await page.getByRole("button", { name: "更新", exact: true }).click();
      await page.getByRole("button", { name: "更新", exact: true }).waitFor();
      await page.getByText("料理", { exact: true }).click();
      assert.equal(
        calls.filter((call) => call.name === "getMenuWithTranslation").length,
        2
      );
      await page.screenshot({
        path: path.join(artifacts, `order-app-menu-${viewport.width}.png`),
        fullPage: true,
      });
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
      // "Add more" must return to the existing menu and drop the completed
      // order from the stack, not push a second menu on top of it.
      await page.getByText("追加注文する", { exact: true }).click();
      await page.getByText("テスト料理", { exact: true }).waitFor();
      await page
        .getByText("20261009-001", { exact: true })
        .waitFor({ state: "detached", timeout: 5000 });
      console.log(
        "PASS",
        viewport.width,
        "QR reload and one order",
        calls.filter((c) => c.name === "createOrder")[0].data.requestId
      );
      await page.goto(
        "http://127.0.0.1:4173/order?restaurant=rest-test&table=table-test"
      );
      await page.getByRole("button", { name: "English", exact: true }).click();
      await page.getByText("Test dish (dictionary)", { exact: true }).click();
      await page.getByText("Add to Cart", { exact: true }).click();
      await page.getByText("🛒 View Cart", { exact: true }).click();
      await page
        .getByText("Test dish (dictionary)", { exact: true })
        .filter({ visible: true })
        .waitFor();
      assert.equal(
        await page
          .getByText(/Translation unverified/)
          .filter({ visible: true })
          .count(),
        0
      );
      await page
        .getByText("←", { exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("button", { name: "DeepL API Only", exact: true })
        .click();
      await page
        .getByText("テスト料理", {
          exact: true,
        })
        .filter({ visible: true })
        .waitFor();
      assert.equal(
        await page
          .getByText("Test dish (dictionary)", { exact: true })
          .filter({ visible: true })
          .count(),
        0
      );
      await page
        .getByText("Translation unavailable; Japanese original", {
          exact: true,
        })
        .first()
        .waitFor();
      await page.screenshot({
        path: path.join(
          artifacts,
          `order-app-translation-${viewport.width}.png`
        ),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "DeepL + Dict", exact: true })
        .click();
      await page.getByText("Test dish (dictionary)", { exact: true }).waitFor();
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
      await page.goto("http://127.0.0.1:4173/staff");
      await page.getByText("スタッフログイン", { exact: true }).waitFor();
      await page
        .getByLabel("メールアドレス", { exact: true })
        .fill("staff@example.invalid");
      await page
        .getByLabel("パスワード", { exact: true })
        .fill("synthetic-password");
      await page.getByRole("button", { name: "ログイン", exact: true }).click();
      await page
        .getByRole("button", { name: "注文 20261009-002 未受付", exact: true })
        .click();
      await page.getByText("要望：ねぎ抜き", { exact: true }).waitFor();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "注文を受け付ける", exact: true })
        .click();
      await page.getByText("状態を更新しました。", { exact: true }).waitFor();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "調理を開始する", exact: true })
        .click();
      await page
        .getByText(
          "別のスタッフが更新しました。最新状態を確認して、必要な操作を選び直してください。",
          { exact: true }
        )
        .waitFor();
      await page
        .getByRole("button", { name: "提供済みにする", exact: true })
        .waitFor();
      assert.equal(staffUpdates, 2);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      assert.deepEqual(cspViolations, []);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      );
      await page.screenshot({
        path: path.join(artifacts, `order-app-staff-${viewport.width}.png`),
        fullPage: true,
      });
      // Staff mark an item sold out from the menu management tab.
      await page
        .getByRole("button", { name: "メニュー管理", exact: true })
        .click();
      await page.getByText("テスト店舗：注文受付中", { exact: true }).waitFor();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", {
          name: "テスト料理を売り切れにする",
          exact: true,
        })
        .click();
      await page.getByText("売り切れにしました。", { exact: true }).waitFor();
      assert.deepEqual(soldOutIds, ["test-item"]);
      await page.getByRole("button", { name: "注文受付", exact: true }).click();
      await page
        .getByRole("button", { name: "ログアウト", exact: true })
        .click();
      await page.getByText("スタッフログイン", { exact: true }).waitFor();
      assert.equal(
        await page.getByText("スタッフ検証料理", { exact: true }).count(),
        0
      );
      console.log(
        "PASS",
        viewport.width,
        "staff login, update, conflict and logout"
      );
      // Customers still see the sold-out item, marked, and cannot add it.
      await page.goto(
        "http://127.0.0.1:4173/order?restaurant=rest-test&table=table-test"
      );
      await page.getByRole("button", { name: "日本語", exact: true }).click();
      await page
        .getByText("売り切れ", { exact: true })
        .filter({ visible: true })
        .first()
        .waitFor();
      await page.getByText("テスト料理", { exact: true }).click();
      const soldOutButton = page
        .getByRole("button", { name: "売り切れ", exact: true })
        .filter({ visible: true });
      await soldOutButton.waitFor();
      assert.equal(await soldOutButton.isDisabled(), true);
      soldOutIds = [];
      console.log("PASS", viewport.width, "staff sold-out shown to customers");
      // The server accepts an order but every response is lost. After a
      // reload the device asks about its stored request instead of reordering.
      loseOrderResponses = true;
      const ordersBefore = calls.filter((c) => c.name === "createOrder").length;
      const dialogs = [];
      const answer = (dialog) => {
        dialogs.push(dialog.message());
        dialog.accept();
      };
      page.on("dialog", answer);
      await page.goto(
        "http://127.0.0.1:4173/order?restaurant=rest-test&table=table-test"
      );
      await page.getByRole("button", { name: "日本語", exact: true }).click();
      await page.getByText("テスト料理", { exact: true }).click();
      await page.getByText("カートに追加", { exact: true }).click();
      await page.getByText("🛒 カートを見る", { exact: true }).click();
      await page.getByText("注文を確定する", { exact: true }).click();
      for (
        let wait = 0;
        wait < 150 &&
        !dialogs.some((m) => m.includes("注文の結果を確認できませんでした"));
        wait++
      )
        await page.waitForTimeout(100);
      assert.ok(
        dialogs.some((m) => m.includes("同じ内容なら注文は重複しません")),
        JSON.stringify(dialogs)
      );
      page.off("dialog", answer);
      const lost = calls
        .filter((c) => c.name === "createOrder")
        .slice(ordersBefore);
      assert.ok(lost.length >= 1);
      assert.equal(new Set(lost.map((c) => c.data.requestId)).size, 1);
      await page.reload();
      await page.getByRole("button", { name: "日本語", exact: true }).click();
      await page
        .getByText(
          "前回の注文は受け付けられています（注文番号 20261009-003）。",
          { exact: true }
        )
        .waitFor();
      assert.deepEqual(
        calls
          .filter((c) => c.name === "getOrderRequest")
          .map((c) => c.data.requestId),
        [lost[0].data.requestId]
      );
      await page
        .getByRole("button", { name: "注文内容を見る", exact: true })
        .click();
      await page.getByText("20261009-003", { exact: true }).waitFor();
      // The device's visit lists both orders it sent from this table.
      await page
        .getByRole("button", { name: "注文履歴を見る", exact: true })
        .click();
      await page
        .getByText(/^この端末から送った注文だけを表示します。/)
        .waitFor();
      for (const number of ["20261009-001", "20261009-003"])
        await page
          .getByText(number, { exact: true })
          .filter({ visible: true })
          .last()
          .waitFor();
      assert.equal(
        await page.getByText("受付待ち", { exact: true }).count(),
        2
      );
      assert.equal(
        calls.filter((c) => c.name === "createOrder").length,
        ordersBefore + lost.length
      );
      loseOrderResponses = false;
      assert.equal(errors.length, 0, JSON.stringify(errors));
      assert.deepEqual(cspViolations, []);
      console.log(
        "PASS",
        viewport.width,
        "lost order response recovered after reload"
      );
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
