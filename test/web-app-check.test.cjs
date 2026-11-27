const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

test("public Web exports require a nonblank App Check key unless explicitly exempted", (t) => {
  const output = mkdtempSync(join(tmpdir(), "order-app-check-"));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  const dir = join(output, "_expo", "static", "js", "web");
  mkdirSync(dir, { recursive: true });
  const bundle = join(dir, "entry.js");
  const check = (allow = "") =>
    spawnSync(
      process.execPath,
      [join(__dirname, "../scripts/check-web-app-check.cjs"), output],
      {
        encoding: "utf8",
        env: { ...process.env, ORDER_APP_ALLOW_NO_APP_CHECK: allow },
      }
    );

  assert.equal(check("1").status, 1);
  writeFileSync(
    join(output, "index.html"),
    '<script src="/_expo/static/js/web/entry.js" defer></script>'
  );
  writeFileSync(
    join(dir, "stale.js"),
    'new n.ReCaptchaEnterpriseProvider("old-key");'
  );
  writeFileSync(bundle, 'const key = "synthetic-unused-key";');
  const missing = check();
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /site key missing/);
  assert.equal(check("true").status, 1);
  assert.equal(check("1").status, 0);
  writeFileSync(bundle, 'new n.ReCaptchaEnterpriseProvider(" ");');
  assert.equal(check().status, 1);
  writeFileSync(bundle, 'new n.ReCaptchaEnterpriseProvider("\\t");');
  assert.equal(check().status, 1);
  writeFileSync(bundle, 'new n.ReCaptchaEnterpriseProvider("synthetic-key");');
  const result = check();
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /synthetic-key/);
});
