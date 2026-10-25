// Backup/restore drill (see test/run-backup.cjs and docs/backup_restore.md).
//   seed:   build synthetic store data through the real handlers
//   verify: after importing the export into a fresh emulator, check that the
//           restored store keeps working and keeps its guarantees.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");

const projectId = "demo-order-app";
const local = /^(127\.0\.0\.1|localhost):\d+$/;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (
  !local.test(process.env.FIRESTORE_EMULATOR_HOST || "") ||
  !local.test(authHost || "")
)
  throw new Error(
    "The drill needs local emulators; production access is forbidden."
  );
const functionsRequire = createRequire(
  require.resolve("../functions/package.json")
);
const { initializeApp, deleteApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");
const { getAuth } = functionsRequire("firebase-admin/auth");
const app = initializeApp({ projectId });
const db = getFirestore(app);
const auth = getAuth(app);
const orders = require("../functions/src/orders");
const menu = require("../functions/src/menu");
const { issueTableTokens } = require("../functions/src/utils/tableToken");
const { fixtures } = require("../functions/test-support/firestore");

const STAFF = {
  uid: "backup-staff",
  email: "backup-staff@example.invalid",
  password: "synthetic-backup-password",
};
const EXPECTED = "drill/expected";
const payload = (requestId, tableId, visitId, tableToken) => ({
  restaurantId: "rest-test",
  tableId,
  requestId,
  visitId,
  tableToken,
  customerLanguage: "ja",
  items: [{ item_id: "item-test", quantity: 2, price: 1000 }],
  subtotal: 2000,
  tax: 200,
  totalAmount: 2200,
});
const signIn = async () => {
  const user = await auth.getUser(STAFF.uid);
  const wait = Date.parse(user.tokensValidAfterTime) + 1000 - Date.now();
  if (wait >= 0) await new Promise((done) => setTimeout(done, wait + 20));
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-only-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...STAFF, returnSecureToken: true }),
    }
  );
  assert.equal(response.ok, true, "Synthetic staff sign-in failed");
  const token = await auth.verifyIdToken((await response.json()).idToken);
  return { uid: token.uid, token };
};

const seed = async () => {
  for (const [path, data] of Object.entries(fixtures()))
    await db.doc(path).set(data);
  await db
    .doc("restaurants/rest-test/tables/table-visit")
    .set({ status: "available", table_number: "7" });
  await auth.createUser(STAFF);
  await auth.setCustomUserClaims(STAFF.uid, {
    role: "staff",
    restaurantId: "rest-test",
  });
  const [{ token }] = await issueTableTokens(db, "rest-test", ["table-test"]);
  const placed = [];
  for (const index of [1, 2, 3])
    placed.push(
      await orders.createOrder.run({
        data: payload(`drill-open-${index}`, "table-test", "visit-open", token),
      })
    );
  const closedOrder = await orders.createOrder.run({
    data: payload("drill-closed-1", "table-visit", "visit-closed"),
  });
  const staff = await signIn();
  await orders.updateOrderStatus.run({
    auth: staff,
    data: {
      orderId: placed[0].orderId,
      expectedStatus: "pending",
      newStatus: "confirmed",
    },
  });
  await orders.correctOrderItems.run({
    auth: staff,
    data: {
      orderId: placed[1].orderId,
      expectedRevision: 0,
      changes: [{ index: 0, quantity: 1 }],
      reason: "合成データの訂正",
      operationId: "drill-fix-1",
    },
  });
  await orders.closeTableVisit.run({
    auth: staff,
    data: { tableId: "table-visit" },
  });
  const numbers = [...placed, closedOrder]
    .map((order) => order.orderNumber)
    .sort();
  await db.doc(EXPECTED).set({
    token,
    count: numbers.length,
    lastNumber: numbers.at(-1),
    retry: { requestId: "drill-open-1", orderId: placed[0].orderId },
    confirmed: placed[0].orderId,
    corrected: placed[1].orderId,
  });
  console.log(`Seeded ${numbers.length} orders for the backup drill.`);
};

const verify = async () => {
  const expected = (await db.doc(EXPECTED).get()).data();
  assert.ok(expected, "The export did not contain the drill data");
  const items = (
    await menu.getMenuWithTranslation.run({
      data: { restaurantId: "rest-test" },
    })
  ).items;
  assert.ok(
    items.some((item) => item.id === "item-test"),
    "menu not restored"
  );
  // Auth users and claims come back with the emulator export (in production
  // they need a separate Auth export; see docs/backup_restore.md).
  const staff = await signIn();
  const listed = await orders.listStaffOrders.run({
    auth: staff,
    data: { view: "all" },
  });
  assert.equal(listed.orders.length, expected.count);
  // Numbering continues from the restored counter; nothing is reused.
  const next = await orders.createOrder.run({
    data: payload(
      "drill-after-restore",
      "table-test",
      "visit-open",
      expected.token
    ),
  });
  const [day, sequence] = expected.lastNumber.split("-");
  assert.equal(
    next.orderNumber,
    `${day}-${String(Number(sequence) + 1).padStart(3, "0")}`
  );
  assert.ok(
    !listed.orders.some((order) => order.order_number === next.orderNumber)
  );
  // A retry of a request accepted before the backup returns the same order.
  const retry = await orders.createOrder.run({
    data: payload(
      expected.retry.requestId,
      "table-test",
      "visit-open",
      expected.token
    ),
  });
  assert.equal(retry.orderId, expected.retry.orderId);
  // The cleared table's visit stays closed; the open visit still lists its orders.
  assert.deepEqual(
    await orders.listVisitOrders.run({
      data: {
        restaurantId: "rest-test",
        tableId: "table-visit",
        visitId: "visit-closed",
      },
    }),
    { closed: true, orders: [] }
  );
  assert.equal(
    (
      await orders.listVisitOrders.run({
        data: {
          restaurantId: "rest-test",
          tableId: "table-test",
          visitId: "visit-open",
        },
      })
    ).orders.length,
    4
  );
  // History, corrections and the hashed table token survived.
  const detail = (
    await orders.getStaffOrder.run({
      auth: staff,
      data: { orderId: expected.confirmed },
    })
  ).order;
  assert.equal(detail.history.length, 1);
  const corrected = (
    await orders.getStaffOrder.run({
      auth: staff,
      data: { orderId: expected.corrected },
    })
  ).order;
  assert.equal(corrected.corrections.length, 1);
  assert.equal(corrected.items[0].quantity, 1);
  process.env.ENFORCE_TABLE_TOKEN = "true";
  try {
    assert.equal(
      (
        await menu.validateQRCode.run({
          data: { qrData: `rest-test/table-test/${expected.token}` },
        })
      ).valid,
      true
    );
    assert.equal(
      (
        await menu.validateQRCode.run({
          data: { qrData: "rest-test/table-test" },
        })
      ).valid,
      false
    );
  } finally {
    delete process.env.ENFORCE_TABLE_TOKEN;
  }
  console.log(
    "Backup drill: restored menu, staff sign-in, numbering, retries, visits, history, corrections and table tokens verified."
  );
};

(async () => {
  try {
    if (process.argv[2] === "seed") await seed();
    else if (process.argv[2] === "verify") await verify();
    else throw new Error("Usage: node test/backup-drill.cjs seed|verify");
  } finally {
    await deleteApp(app);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
