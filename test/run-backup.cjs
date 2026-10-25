// Backup/restore drill on emulators: build synthetic data, export it, then
// import it into a fresh emulator and check the restored store still works.
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { runWithEmulators } = require("./emulators.cjs");

const snapshot = join(
  mkdtempSync(join(tmpdir(), "order-app-backup-")),
  "export"
);
const seeded = runWithEmulators("node test/backup-drill.cjs seed", {
  extra: ["--export-on-exit", snapshot],
});
if (seeded !== 0) process.exit(seeded);
process.exitCode = runWithEmulators("node test/backup-drill.cjs verify", {
  extra: ["--import", snapshot],
});
