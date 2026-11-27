const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const root = resolve(__dirname, "..");
const workspace = mkdtempSync(join(tmpdir(), "order-app-web-env-"));
const envFile = join(workspace, "synthetic.env");
const checkAppCheck = process.argv.includes("--check-app-check");
const config = {
  FIREBASE_API_KEY: "synthetic-test-key-not-a-real-secret",
  FIREBASE_AUTH_DOMAIN: "demo-order-app.firebaseapp.com",
  FIREBASE_PROJECT_ID: "demo-order-app",
  FIREBASE_STORAGE_BUCKET: "demo-order-app.appspot.com",
  FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  FIREBASE_APP_ID: "1:1234567890:web:synthetic-test",
};
if (checkAppCheck) config.FIREBASE_APPCHECK_SITE_KEY = "synthetic-site-key";
writeFileSync(
  envFile,
  Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
);
const output = checkAppCheck
  ? join(workspace, "export")
  : process.env.ORDER_APP_WEB_DIR || join(tmpdir(), "order-app-web-test");
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
try {
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  if (checkAppCheck && process.exitCode === 0) {
    const check = spawnSync(
      process.execPath,
      ["scripts/check-web-app-check.cjs", output],
      {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, ORDER_APP_ALLOW_NO_APP_CHECK: "" },
      }
    );
    if (check.error) throw check.error;
    process.exitCode = check.status ?? 1;
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
