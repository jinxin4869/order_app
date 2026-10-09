const { mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const root = resolve(__dirname, "..");
const workspace = mkdtempSync(join(tmpdir(), "order-app-web-env-"));
const envFile = join(workspace, "synthetic.env");
const config = {
  FIREBASE_API_KEY: "synthetic-test-key-not-a-real-secret",
  FIREBASE_AUTH_DOMAIN: "demo-order-app.firebaseapp.com",
  FIREBASE_PROJECT_ID: "demo-order-app",
  FIREBASE_STORAGE_BUCKET: "demo-order-app.appspot.com",
  FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  FIREBASE_APP_ID: "1:1234567890:web:synthetic-test",
};
writeFileSync(
  envFile,
  Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
);
const output =
  process.env.ORDER_APP_WEB_DIR || join(tmpdir(), "order-app-web-test");
const result = spawnSync(
  process.execPath,
  [
    "node_modules/expo/bin/cli",
    "export",
    "--platform",
    "web",
    "--output-dir",
    output,
    "--clear",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      PATH: process.env.PATH,
      ...config,
      CI: "1",
      NODE_ENV: "production",
      EXPO_NO_DOTENV: "1",
      EXPO_NO_TELEMETRY: "1",
      __UNSAFE_EXPO_HOME_DIRECTORY: workspace,
      ORDER_APP_ENV_FILE: envFile,
    },
  }
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
