// firebase.json の functions.predeploy から実行する。3つの ENFORCE_ が
// true か false で明示されていなければ、Functions のデプロイを止める。
// 実行時は "true" 以外をすべて「強制なし」として扱うため、設定の入れ忘れや
// 書き間違いがデプロイ時に見えない。エミュレーターやテストでは実行されない。
const fs = require("node:fs");
const path = require("node:path");

const KEYS = [
  "ENFORCE_APP_CHECK",
  "ENFORCE_ORDER_LIMITS",
  "ENFORCE_TABLE_TOKEN",
];

// Reads only the three keys, and only the plain `KEY=value` spelling. Quotes
// and trailing comments are reported as invalid instead of being interpreted,
// so this never has to agree with the CLI's dotenv parser on edge cases.
const readKeys = (text) => {
  const found = {};
  for (const [, key, value] of text.matchAll(
    /^[ \t]*(?:export[ \t]+)?(\w+)[ \t]*=(.*)$/gm
  ))
    if (KEYS.includes(key)) found[key] = value.trim();
  return found;
};

// `files` maps a dotenv file name in functions/ to its text. The CLI always
// loads .env and .env.<projectId>; a file named after a project alias is
// loaded only when the deploy uses that alias, so it cannot supply a missing
// value here, but a value it does set must still be valid.
const checkDeployEnv = (files, projectId) => {
  const errors = [];
  const loaded = [".env", `.env.${projectId}`];
  const values = {};
  const overrides = [];
  for (const [file, text] of Object.entries(files)) {
    const found = readKeys(text);
    for (const [key, value] of Object.entries(found))
      if (value !== "true" && value !== "false")
        errors.push(
          `functions/${file}: ${key}=${value} は使えません。${key}=true か ${key}=false とだけ書いてください（引用符・行末コメントなし）。`
        );
    if (!loaded.includes(file) && Object.keys(found).length)
      overrides.push(file);
  }
  for (const file of loaded) Object.assign(values, readKeys(files[file] || ""));
  for (const key of KEYS)
    if (!(key in values))
      errors.push(
        `${key} が未設定です。functions/.env に ${key}=true か ${key}=false を書いてください。`
      );
  return { errors, values, overrides };
};

// .env.example is a template and .env.local is read by the emulator only.
const readEnvFiles = (dir) =>
  Object.fromEntries(
    fs
      .readdirSync(dir)
      .filter(
        (name) =>
          /^\.env(\..+)?$/.test(name) &&
          name !== ".env.example" &&
          name !== ".env.local"
      )
      .map((name) => [name, fs.readFileSync(path.join(dir, name), "utf8")])
  );

if (require.main === module) {
  // The CLI passes the resolved project ID as GCLOUD_PROJECT.
  const projectId = process.argv[2] || process.env.GCLOUD_PROJECT || "";
  const { errors, values, overrides } = checkDeployEnv(
    readEnvFiles(path.join(__dirname, "..")),
    projectId
  );
  if (errors.length) {
    console.error(
      [
        "Functions の強制スイッチが明示されていないため、デプロイできません。",
        ...errors.map((error) => `  - ${error}`),
        "functions/.env.example を functions/.env にコピーし、3つすべてを true か false にしてください。",
        "意味と有効にする順序: docs/app_check.md, docs/order_limits.md, docs/table_tokens.md",
      ].join("\n")
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Functions の強制スイッチ: ${KEYS.map((key) => `${key}=${values[key]}`).join(" ")}`
    );
    if (overrides.length)
      console.log(
        `注意: ${overrides.map((file) => `functions/${file}`).join(", ")} にも設定があります。その名前のエイリアスでデプロイすると、そちらの値が優先されます。`
      );
  }
}

module.exports = { checkDeployEnv, readEnvFiles };
