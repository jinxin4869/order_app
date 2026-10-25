const { readFileSync, mkdtempSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { tmpdir } = require("node:os");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { createRequire } = require("node:module");
const rulesRequire = createRequire(
  require.resolve("@firebase/rules-unit-testing")
);
const { doc, setDoc, getDoc, updateDoc, deleteDoc } =
  rulesRequire("firebase/firestore");

const projectId = "demo-order-app";
const host = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const local = /^(127\.0\.0\.1|localhost):\d+$/;
if (!local.test(host || "") || !local.test(authHost || "")) {
  throw new Error(
    "These tests require local Firestore and Auth emulators; production access is forbidden."
  );
}
async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  const functionsRequire = createRequire(
    require.resolve("../functions/package.json")
  );
  const { initializeApp, deleteApp } = functionsRequire("firebase-admin/app");
  const { getFirestore } = functionsRequire("firebase-admin/firestore");
  const { getAuth } = functionsRequire("firebase-admin/auth");
  const app = initializeApp({ projectId });
  const serverDb = getFirestore(app);
  const serverAuth = getAuth(app);
  const uid = "staff-test";
  const credentials = {
    email: "staff-test@example.invalid",
    password: "synthetic-staff-password",
    returnSecureToken: true,
  };
  const claims = { role: "staff", restaurantId: "rest-test" };
  const signIn = async () => {
    // Cutoffs have second precision; use a sign-in after that second, not a
    // refreshed token from an old session. This is bounded to about one second.
    const user = await serverAuth.getUser(uid);
    const wait = Date.parse(user.tokensValidAfterTime) + 1000 - Date.now();
    if (wait >= 0)
      await new Promise((resolve) => setTimeout(resolve, wait + 20));
    const response = await fetch(
      `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-only-key`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
      }
    );
    assert.equal(response.ok, true, "Synthetic emulator sign-in failed");
    const { idToken } = await response.json();
    const token = await serverAuth.verifyIdToken(idToken);
    return { uid: token.uid, token };
  };
  try {
    await env.clearFirestore();
    await serverAuth.createUser({
      uid,
      email: credentials.email,
      password: credentials.password,
    });
    await serverAuth.setCustomUserClaims(uid, claims);
    const { fixtures } = require("../functions/test-support/firestore");
    for (const [path, data] of Object.entries(fixtures()))
      await serverDb.doc(path).set(data);
    const anonymous = env.unauthenticatedContext().firestore();
    const staff = env
      .authenticatedContext("staff-test", {
        role: "staff",
        restaurantId: "rest-test",
      })
      .firestore();
    for (const db of [anonymous, staff]) {
      await assertFails(setDoc(doc(db, "orders/forged"), { total_amount: 0 }));
      await assertFails(
        setDoc(doc(db, "restaurants/rest-test/menu_items/forged"), { price: 0 })
      );
    }
    await assertSucceeds(
      getDoc(doc(anonymous, "restaurants/rest-test/menu_items/item-test"))
    );
    // Only published items are readable directly; private ones never are.
    await serverDb.doc("restaurants/rest-test/menu_items/private-test").set({
      name_ja: "非公開",
      price: 1,
      is_available: true,
      is_published: false,
    });
    await serverDb
      .doc("restaurants/rest-test/menu_items/legacy-off-test")
      .set({ name_ja: "旧・販売不可", price: 1, is_available: false });
    await serverDb.doc("restaurants/rest-test/menu_items/sold-out-test").set({
      name_ja: "売り切れ",
      price: 1,
      is_available: false,
      is_published: true,
    });
    for (const id of ["private-test", "legacy-off-test"])
      await assertFails(
        getDoc(doc(anonymous, `restaurants/rest-test/menu_items/${id}`))
      );
    await assertSucceeds(
      getDoc(doc(anonymous, "restaurants/rest-test/menu_items/sold-out-test"))
    );
    await assertFails(
      getDoc(doc(anonymous, "restaurants/rest-test/menu_events/any"))
    );
    await assertFails(getDoc(doc(anonymous, "dictionary/private-test")));
    await assertFails(getDoc(doc(anonymous, "translation_cache/private-test")));
    const { createOrder } = require("../functions/src/orders");
    const orderData = {
      restaurantId: "rest-test",
      tableId: "table-test",
      requestId: "request-emulator-0001",
      customerLanguage: "en",
      items: [
        {
          item_id: "item-test",
          name: "Test dish",
          name_ja: "テスト料理",
          price: 1000,
          quantity: 1,
        },
      ],
      subtotal: 1000,
      tax: 100,
      totalAmount: 1100,
    };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => createOrder.run({ data: orderData }))
    );
    const result = results[0];
    assert.equal(new Set(results.map((order) => order.orderId)).size, 1);
    assert.equal(new Set(results.map((order) => order.orderNumber)).size, 1);
    assert.equal((await serverDb.collection("orders").get()).size, 1);
    // Order limits hold under real concurrent transactions.
    await serverDb
      .doc("restaurants/rest-test/tables/table-limit")
      .set({ status: "available", table_number: "9" });
    process.env.ENFORCE_ORDER_LIMITS = "true";
    process.env.ORDER_LIMIT_PER_TABLE = "3";
    try {
      const limited = await Promise.allSettled(
        Array.from({ length: 6 }, (_, index) =>
          createOrder.run({
            data: {
              ...orderData,
              tableId: "table-limit",
              requestId: `limit-emulator-${index}`,
            },
          })
        )
      );
      assert.equal(limited.filter((r) => r.status === "fulfilled").length, 3);
      assert.ok(
        limited
          .filter((r) => r.status === "rejected")
          .every((r) => r.reason.details?.reason === "rate_limited")
      );
    } finally {
      delete process.env.ENFORCE_ORDER_LIMITS;
      delete process.env.ORDER_LIMIT_PER_TABLE;
    }
    assert.equal(
      (
        await serverDb
          .collection("orders")
          .where("table_id", "==", "table-limit")
          .get()
      ).size,
      3
    );
    await assertFails(
      getDoc(doc(anonymous, "restaurants/rest-test/rate_limits/alerts"))
    );
    // Remove them so the order counts below are unaffected.
    for (const placed of (
      await serverDb
        .collection("orders")
        .where("table_id", "==", "table-limit")
        .get()
    ).docs)
      await placed.ref.delete();
    // The issuing script stores only a hash; with enforcement on, only the
    // printed URL's token passes QR validation and ordering.
    await serverDb
      .doc("restaurants/rest-test/tables/table-token")
      .set({ status: "available", table_number: "8" });
    const sheet = join(
      mkdtempSync(join(tmpdir(), "order-app-tokens-")),
      "tokens.csv"
    );
    execFileSync(
      process.execPath,
      [
        "scripts/issue-table-tokens.cjs",
        "--project",
        projectId,
        "--restaurant",
        "rest-test",
        "--origin",
        "https://example.test",
        "--tables",
        "table-token",
        "--out",
        sheet,
      ],
      { cwd: resolve(__dirname, ".."), env: process.env, stdio: "pipe" }
    );
    const printed = readFileSync(sheet, "utf8").trim().split("\n")[1];
    const qrUrl = JSON.parse(printed.split(",")[2]);
    const token = new URL(qrUrl).searchParams.get("token");
    const secretPath = "restaurants/rest-test/table_secrets/table-token";
    assert.notEqual(
      (await serverDb.doc(secretPath).get()).data().token_hash,
      token
    );
    const { validateQRCode } = require("../functions/src/menu");
    process.env.ENFORCE_TABLE_TOKEN = "true";
    try {
      assert.equal(
        (await validateQRCode.run({ data: { qrData: qrUrl } })).valid,
        true
      );
      assert.equal(
        (
          await validateQRCode.run({
            data: { qrData: "rest-test/table-token" },
          })
        ).valid,
        false
      );
      const tokenOrder = {
        ...orderData,
        tableId: "table-token",
        requestId: "token-emulator",
      };
      await assert.rejects(createOrder.run({ data: tokenOrder }), {
        code: "failed-precondition",
      });
      const placed = await createOrder.run({
        data: { ...tokenOrder, tableToken: token },
      });
      await serverDb.doc(`orders/${placed.orderId}`).delete();
    } finally {
      delete process.env.ENFORCE_TABLE_TOKEN;
    }
    await assertFails(getDoc(doc(anonymous, secretPath)));
    // Only the device holding the request ID can learn the result.
    const { getOrderRequest } = require("../functions/src/orders");
    const ask = (requestId) =>
      getOrderRequest.run({
        data: { restaurantId: "rest-test", tableId: "table-test", requestId },
      });
    assert.deepEqual(await ask(orderData.requestId), {
      accepted: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    });
    assert.deepEqual(await ask("request-emulator-unknown"), {
      accepted: false,
    });
    const processed = await serverDb.collection("order_requests").get();
    for (const db of [anonymous, staff])
      await assertFails(
        getDoc(doc(db, `order_requests/${processed.docs[0].id}`))
      );
    const distinct = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        createOrder.run({
          data: { ...orderData, requestId: `distinct-emulator-${index}` },
        })
      )
    );
    assert.equal(
      new Set([result, ...distinct].map((order) => order.orderNumber)).size,
      7
    );
    assert.equal((await serverDb.collection("orders").get()).size, 7);
    const {
      listStaffOrders,
      getStaffOrder,
      updateOrderStatus,
    } = require("../functions/src/orders");
    const auth = await signIn();
    const first = await listStaffOrders.run({ auth, data: { limit: 3 } });
    const second = await listStaffOrders.run({
      auth,
      data: { limit: 3, cursor: first.cursor },
    });
    const third = await listStaffOrders.run({
      auth,
      data: { limit: 3, cursor: second.cursor },
    });
    assert.equal(
      new Set(
        [...first.orders, ...second.orders, ...third.orders].map(
          (order) => order.id
        )
      ).size,
      7
    );
    assert.equal(third.hasMore, false);
    // The number comes from the table master at order time, not the internal ID.
    for (const listed of first.orders)
      assert.deepEqual(
        [listed.table_id, listed.table_number],
        ["table-test", "12"]
      );
    const race = await Promise.allSettled(
      ["confirmed", "cancelled"].map((newStatus) =>
        updateOrderStatus.run({
          auth,
          data: {
            orderId: result.orderId,
            expectedStatus: "pending",
            newStatus,
          },
        })
      )
    );
    assert.equal(race.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(
      race.find((item) => item.status === "rejected").reason.code,
      "aborted"
    );
    const detail = (
      await getStaffOrder.run({ auth, data: { orderId: result.orderId } })
    ).order;
    assert.equal(detail.restaurant_id, "rest-test");
    // Only the winning update of the race above leaves a history record.
    assert.equal(detail.history.length, 1);
    assert.equal(detail.history[0].from_status, "pending");
    assert.equal(detail.history[0].staff_email, credentials.email);
    assert.equal(detail.table_number, "12");
    await assert.rejects(
      getStaffOrder.run({
        auth: {
          ...auth,
          token: { ...auth.token, restaurantId: "other-store" },
        },
        data: { orderId: result.orderId },
      }),
      { code: "permission-denied" }
    );
    const { batchTranslateMenu } = require("../functions/src/translation");
    const protectedCalls = (session) => [
      () => listStaffOrders.run({ auth: session, data: {} }),
      () =>
        getStaffOrder.run({ auth: session, data: { orderId: result.orderId } }),
      () =>
        updateOrderStatus.run({
          auth: session,
          data: {
            orderId: result.orderId,
            expectedStatus: "pending",
            newStatus: "confirmed",
          },
        }),
      () =>
        batchTranslateMenu.run({
          auth: session,
          data: { restaurantId: "rest-test", targetLang: "en" },
        }),
    ];
    const assertDenied = async (session, code) => {
      const before = (
        await serverDb.doc("orders/" + result.orderId).get()
      ).data();
      for (const call of protectedCalls(session))
        await assert.rejects(call, { code });
      assert.deepEqual(
        (await serverDb.doc("orders/" + result.orderId).get()).data(),
        before
      );
    };
    // Reuse exactly the previously issued token while current Auth state changes.
    await serverAuth.updateUser(uid, { disabled: true });
    await assertDenied(auth, "unauthenticated");
    await serverAuth.revokeRefreshTokens(uid);
    await serverAuth.updateUser(uid, { disabled: false });
    await assertDenied(auth, "unauthenticated");
    const reactivated = await signIn();
    // The confirmed/cancelled race above has no fixed winner, and a cancelled
    // order leaves the active view, so count every order instead.
    assert.equal(
      (
        await listStaffOrders.run({
          auth: reactivated,
          data: { view: "all" },
        })
      ).orders.length,
      7
    );
    // A device's visit lists only its own orders until staff clear the table.
    await serverDb
      .doc("restaurants/rest-test/tables/table-visit")
      .set({ status: "available", table_number: "7" });
    const {
      listVisitOrders,
      closeTableVisit,
    } = require("../functions/src/orders");
    const visit = {
      restaurantId: "rest-test",
      tableId: "table-visit",
      visitId: "visit-emulator-1",
    };
    const placed = await createOrder.run({
      data: {
        ...orderData,
        tableId: "table-visit",
        requestId: "visit-emulator-order",
        visitId: visit.visitId,
      },
    });
    assert.deepEqual(
      (await listVisitOrders.run({ data: visit })).orders.map(
        (order) => order.order_number
      ),
      [placed.orderNumber]
    );
    assert.deepEqual(
      (
        await listVisitOrders.run({
          data: { ...visit, visitId: "visit-emulator-2" },
        })
      ).orders,
      []
    );
    await closeTableVisit.run({
      auth: reactivated,
      data: { tableId: "table-visit" },
    });
    assert.deepEqual(await listVisitOrders.run({ data: visit }), {
      closed: true,
      orders: [],
    });
    assert.equal(
      (
        await serverDb.doc("restaurants/rest-test/tables/table-visit").get()
      ).data().status,
      "available"
    );
    // Staff sell out an item with their real token; the order is then refused
    // in the same transaction that would have saved it.
    const { setMenuItemAvailability } = require("../functions/src/menu/staff");
    assert.deepEqual(
      await setMenuItemAvailability.run({
        auth: reactivated,
        data: {
          itemId: "item-test",
          available: false,
          expectedVersion: 0,
          operationId: "menu-emulator-op",
        },
      }),
      { success: true, available: false, version: 1 }
    );
    await assert.rejects(
      createOrder.run({
        data: { ...orderData, requestId: "after-sold-out" },
      }),
      { code: "failed-precondition" }
    );
    assert.equal(
      (
        await serverDb
          .doc("restaurants/rest-test/menu_events/menu-emulator-op")
          .get()
      ).data().staff_email,
      credentials.email
    );
    await assertSucceeds(
      getDoc(doc(anonymous, "restaurants/rest-test/menu_items/item-test"))
    );
    await serverAuth.setCustomUserClaims(uid, {
      role: "staff",
      restaurantId: "other-store",
    });
    await assertDenied(reactivated, "permission-denied");
    const transferred = await signIn();
    assert.equal(
      (await listStaffOrders.run({ auth: transferred, data: {} })).orders
        .length,
      0
    );
    await assert.rejects(
      getStaffOrder.run({
        auth: transferred,
        data: { orderId: result.orderId },
      }),
      { code: "permission-denied" }
    );
    await serverAuth.setCustomUserClaims(uid, { role: "customer" });
    await assertDenied(transferred, "permission-denied");
    await serverAuth.deleteUser(uid);
    await assertDenied(transferred, "unauthenticated");
    assert.equal(result.success, true);
    const record = await serverDb.doc("orders/" + result.orderId).get();
    assert.equal(record.data().total_amount, 1100);
    assert.equal(
      (
        await serverDb.doc("restaurants/rest-test/tables/table-test").get()
      ).data().status,
      "occupied"
    );
    for (const db of [anonymous, staff]) {
      const ref = doc(db, "orders/" + result.orderId);
      await assertFails(getDoc(ref));
      await assertFails(updateDoc(ref, { status: "completed" }));
      await assertFails(deleteDoc(ref));
      const events = await serverDb
        .collection(`orders/${result.orderId}/status_history`)
        .get();
      await assertFails(
        getDoc(
          doc(
            db,
            `orders/${result.orderId}/status_history/${events.docs[0].id}`
          )
        )
      );
      await assertFails(
        setDoc(doc(db, `orders/${result.orderId}/status_history/forged`), {
          to_status: "completed",
        })
      );
    }
    console.log(
      "Firestore/Auth emulators: direct writes denied; orders and staff stop, revocation, transfer, reactivation verified."
    );
  } finally {
    await serverAuth.deleteUser(uid).catch((error) => {
      if (error.code !== "auth/user-not-found") throw error;
    });
    await env.clearFirestore();
    await env.cleanup();
    await deleteApp(app);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
