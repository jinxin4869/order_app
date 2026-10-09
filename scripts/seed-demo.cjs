// Synthetic fixture only. This script refuses every non-local endpoint.
const local = /^(127\.0\.0\.1|localhost):\d+$/;
for (const name of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"])
  if (!local.test(process.env[name] || ""))
    throw new Error(`${name} must be a local emulator endpoint`);
const { createRequire } = require("node:module");
const functionsRequire = createRequire(
  require.resolve("../functions/package.json")
);
const { initializeApp, deleteApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");
const { getAuth } = functionsRequire("firebase-admin/auth");
const app = initializeApp({ projectId: "demo-order-app" });
async function main() {
  const { fixtures } = require("../functions/test-support/firestore");
  const db = getFirestore(app);
  const data = {
    ...fixtures(),
    "restaurants/rest-test/menu_categories/dishes": {
      name_ja: "料理",
      is_available: true,
      order: 1,
    },
    "restaurants/rest-test/menu_items/item-test": {
      ...fixtures()["restaurants/rest-test/menu_items/item-test"],
      category_id: "dishes",
      description_ja: "エミュレーター専用の合成データです",
    },
    "dictionary/demo-term": {
      term_ja: "テスト料理",
      term_en: "Synthetic dish",
      term_zh: "测试菜",
      priority: 1,
    },
  };
  const batch = db.batch();
  for (const [path, value] of Object.entries(data))
    batch.set(db.doc(path), value);
  await batch.commit();
  const auth = getAuth(app);
  const uid = "demo-staff";
  try {
    await auth.getUser(uid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    await auth.createUser({
      uid,
      email: "staff@example.invalid",
      password: "demo-only-password",
    });
  }
  await auth.setCustomUserClaims(uid, {
    role: "staff",
    restaurantId: "rest-test",
  });
  if (process.argv.includes("--verify")) {
    const assert = require("node:assert/strict");
    const menu =
      await require("../functions/src/menu").getMenuWithTranslation.run({
        data: { restaurantId: "rest-test" },
      });
    assert.equal(menu.items.length, 1);
    assert.equal(menu.categories.length, 1);
    assert.deepEqual((await auth.getUser(uid)).customClaims, {
      role: "staff",
      restaurantId: "rest-test",
    });
  }
  console.log(
    "Synthetic demo seeded and verified in demo-order-app local emulators."
  );
}
main()
  .catch(() => {
    console.error(
      "Local demo setup failed. Check emulator endpoints and dependencies."
    );
    process.exitCode = 1;
  })
  .finally(() => deleteApp(app));
