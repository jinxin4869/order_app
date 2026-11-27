const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const output = process.argv[2] || "dist";
// Match the provider being constructed with a site key (URL-safe characters) in the export.
const provider =
  /new\s+[\w$.]*\bReCaptchaEnterpriseProvider\(\s*(?:"[\w-]+"|'[\w-]+')\s*\)/;

try {
  // Expo may leave hashed bundles from earlier exports in the output folder.
  // Check the scripts loaded by the current index, so stale keys cannot pass.
  const html = readFileSync(join(output, "index.html"), "utf8");
  const scripts = [
    ...html.matchAll(
      /<script\b[^>]*\bsrc=["']\/?(_expo\/static\/js\/web\/[\w.-]+\.js)["']/g
    ),
  ].map(([, file]) => readFileSync(join(output, file), "utf8"));
  if (!scripts.length) throw new Error("No Expo Web entry scripts found.");
  if (process.env.ORDER_APP_ALLOW_NO_APP_CHECK === "1") {
    console.log("Web export explicitly allowed without App Check.");
  } else if (scripts.some((script) => provider.test(script))) {
    console.log("App Check site key found in the Web export.");
  } else {
    throw new Error(
      "App Check site key missing from the Web export. Set FIREBASE_APPCHECK_SITE_KEY and rebuild. For an environment without App Check, set ORDER_APP_ALLOW_NO_APP_CHECK=1 explicitly."
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
