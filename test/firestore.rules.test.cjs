const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const assert = require("node:assert/strict");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { createRequire } = require("node:module");
const rulesRequire = createRequire(require.resolve("@firebase/rules-unit-testing"));
const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} = rulesRequire("firebase/firestore");

const projectId = "demo-order-app";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error(
    "These tests require a local Firestore emulator; production access is forbidden."
  );
}
async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  const admin = require("../functions/node_modules/firebase-admin");
  const app = admin.initializeApp({ projectId });
  const serverDb = admin.firestore(app);
  try {
    await env.clearFirestore();
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
    const result = await createOrder.run({
      data: {
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
      },
    });
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
      "Firestore rules: direct writes denied; public menu allowed; real createOrder succeeded."
    );
  } finally {
    await env.clearFirestore();
    await env.cleanup();
    await app.delete();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
