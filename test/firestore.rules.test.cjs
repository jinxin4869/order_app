const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
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
