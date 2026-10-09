const test = require("node:test");
const assert = require("node:assert/strict");
const { assessReport } = require("../scripts/audit-dependencies.cjs");
const url = "https://github.com/advisories/GHSA-test-test-test";
const path = "node_modules/example";
const lock = { packages: { [path]: { version: "1.0.0" } } };
const exception = {
  scope: "root",
  package: "example",
  advisory: url,
  paths: [path],
  versions: ["1.0.0"],
  expires: "2026-10-24T00:00:00+09:00",
};
const report = (severity = "high") => ({
  metadata: { vulnerabilities: {} },
  vulnerabilities: {
    example: { nodes: [path], via: [{ name: "example", severity, url }] },
  },
});
const beforeExpiry = Date.parse("2026-10-10T00:00:00+09:00");

test("new high advisories fail", () =>
  assert.equal(
    assessReport(report(), "root", lock, [], beforeExpiry).failures.length,
    1
  ));
test("a documented exact package/version/path can pass temporarily", () =>
  assert.equal(
    assessReport(report(), "root", lock, [exception], beforeExpiry).failures
      .length,
    0
  ));
test("exceptions expire at the stated instant", () =>
  assert.equal(
    assessReport(
      report(),
      "root",
      lock,
      [exception],
      Date.parse(exception.expires)
    ).failures.length,
    1
  ));
test("root exceptions never cover Functions", () =>
  assert.equal(
    assessReport(report(), "functions", lock, [exception], beforeExpiry)
      .failures.length,
    1
  ));
test("version changes require a new review", () =>
  assert.equal(
    assessReport(
      report(),
      "root",
      { packages: { [path]: { version: "1.0.1" } } },
      [exception],
      beforeExpiry
    ).failures.length,
    1
  ));
test("critical advisories cannot be excepted", () =>
  assert.equal(
    assessReport(report("critical"), "root", lock, [exception], beforeExpiry)
      .failures.length,
    1
  ));
test("a different advisory on the same package is not exempt", () => {
  const changed = report();
  changed.vulnerabilities.example.via[0].url = `${url}-new`;
  assert.equal(
    assessReport(changed, "root", lock, [exception], beforeExpiry).failures
      .length,
    1
  );
});
test("a new nested dependency path is not exempt", () => {
  const changed = report();
  changed.vulnerabilities.example.nodes.push(
    "node_modules/parent/node_modules/example"
  );
  assert.equal(
    assessReport(changed, "root", lock, [exception], beforeExpiry).failures
      .length,
    1
  );
});
test("audit service errors fail closed", () =>
  assert.throws(() =>
    assessReport(
      { error: { code: "unavailable" } },
      "root",
      lock,
      [],
      beforeExpiry
    )
  ));
