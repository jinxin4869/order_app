const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");

// A fresh CLI config prevents tests from using a developer's Firebase login.
const demo = process.argv.includes("--demo");
const config = mkdtempSync(join(tmpdir(), "order-app-test-config-"));
const result = spawnSync(
  process.execPath,
  [
    require.resolve("firebase-tools/lib/bin/firebase.js"),
    "emulators:exec",
    "--project",
    "demo-order-app",
    "--config",
    demo ? "firebase.demo.json" : "firebase.test.json",
    "--only",
    demo ? "firestore,auth" : "firestore",
    demo
      ? "node scripts/seed-demo.cjs --verify"
      : "node test/firestore.rules.test.cjs",
  ],
  {
    cwd: resolve(__dirname, ".."),
    stdio: "inherit",
    env: {
      PATH: process.env.PATH,
      ...(process.env.JAVA_HOME ? { JAVA_HOME: process.env.JAVA_HOME } : {}),
      ...(process.env.NODE_PATH ? { NODE_PATH: process.env.NODE_PATH } : {}),
      XDG_CONFIG_HOME: config,
      FIREBASE_CLI_DISABLE_USAGE_REPORTING: "1",
      FIREBASE_EMULATORS_PATH:
        process.env.FIREBASE_EMULATORS_PATH ||
        join(tmpdir(), "order-app-firestore-emulators"),
    },
  }
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
