const { runWithEmulators } = require("./emulators.cjs");

const demo = process.argv.includes("--demo");
process.exitCode = runWithEmulators(
  demo
    ? "node scripts/seed-demo.cjs --verify"
    : "node test/firestore.rules.test.cjs",
  { config: demo ? "firebase.demo.json" : "firebase.test.json" }
);
