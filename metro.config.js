const { createHash } = require("node:crypto");
const { readdirSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

// react-native-dotenv (babel.config.js) inlines the environment file into the
// bundle at transform time, but Metro's transform cache does not look at that
// file. Fold its contents into the cache key so that a build after switching
// environments cannot reuse the previous environment's values.
// Values exported only in the shell are not covered: `npm run build:web`
// (--clear) is the supported production build.
function envFilesHash() {
  const hash = createHash("sha1");
  const envFiles = new Set([
    path.resolve(__dirname, ".env"), // also loaded into process.env by Expo CLI
    path.resolve(process.env.ORDER_APP_ENV_FILE || ".env"),
  ]);
  for (const envFile of envFiles) {
    const dir = path.dirname(envFile);
    let names = [];
    try {
      names = readdirSync(dir).sort();
    } catch {
      // No directory, no environment files.
    }
    // The plugin and Expo CLI also read variants such as `.env.local` and
    // `.env.production`.
    for (const name of names) {
      if (!name.startsWith(path.basename(envFile))) continue;
      try {
        hash.update(`${name}\0`).update(readFileSync(path.join(dir, name)));
      } catch {
        // Not a readable file.
      }
    }
  }
  return hash.digest("hex");
}

const config = getDefaultConfig(__dirname);
config.cacheVersion = `${config.cacheVersion}:${envFilesHash()}`;

module.exports = config;
