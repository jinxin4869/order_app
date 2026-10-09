const { spawnSync } = require("node:child_process");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { tmpdir } = require("node:os");

function assessReport(report, scope, lock, exceptions, now = Date.now()) {
  if (
    report.error ||
    !report.metadata?.vulnerabilities ||
    !report.vulnerabilities
  )
    throw new Error("npm audit did not return a valid vulnerability report");
  const failures = [];
  const accepted = new Set();
  for (const vulnerability of Object.values(report.vulnerabilities)) {
    for (const advisory of vulnerability.via) {
      if (typeof advisory === "string") {
        if (!report.vulnerabilities[advisory])
          failures.push(`Unresolved advisory dependency: ${advisory}`);
        continue;
      }
      if (!["high", "critical"].includes(advisory.severity)) continue;
      const nodes = vulnerability.nodes;
      const exception =
        advisory.severity === "high" &&
        exceptions.find(
          (entry) =>
            entry.scope === scope &&
            entry.package === advisory.name &&
            entry.advisory === advisory.url &&
            Date.parse(entry.expires) > now &&
            nodes.length > 0 &&
            nodes.every(
              (path) =>
                entry.paths.includes(path) &&
                entry.versions.includes(lock.packages[path]?.version)
            )
        );
      if (exception) accepted.add(advisory.url);
      else
        failures.push(
          `${scope}: ${advisory.name} ${advisory.severity} ${advisory.url}`
        );
    }
  }
  return { failures: [...new Set(failures)], accepted: [...accepted] };
}

function main() {
  const root = resolve(__dirname, "..");
  const policy = JSON.parse(
    readFileSync(join(root, "docs/dependency-audit-exceptions.json"), "utf8")
  );
  const artifacts =
    process.env.ORDER_APP_AUDIT_ARTIFACTS ||
    join(tmpdir(), "order-app-dependency-audit");
  mkdirSync(artifacts, { recursive: true });
  let failed = false;
  for (const [scope, production] of [
    ["functions", true],
    ["functions", false],
    ["root", true],
    ["root", false],
  ]) {
    const cwd = scope === "root" ? root : join(root, "functions");
    const args = ["audit", "--json", "--registry=https://registry.npmjs.org"];
    if (production) args.push("--omit=dev");
    const result = spawnSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      args,
      {
        cwd,
        encoding: "utf8",
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
      }
    );
    if (result.error || ![0, 1].includes(result.status))
      throw new Error(`npm audit failed for ${scope}`);
    const report = JSON.parse(result.stdout);
    writeFileSync(
      join(artifacts, `${scope}-${production ? "production" : "all"}.json`),
      JSON.stringify(report, null, 2)
    );
    const lock = JSON.parse(
      readFileSync(join(cwd, "package-lock.json"), "utf8")
    );
    const assessment = assessReport(report, scope, lock, policy.exceptions);
    console.log(
      `${scope} ${production ? "production" : "all"}: ${JSON.stringify(report.metadata.vulnerabilities)}; time-limited high exceptions: ${assessment.accepted.length}`
    );
    for (const failure of assessment.failures) console.error(failure);
    failed ||= assessment.failures.length > 0;
  }
  process.exitCode = failed ? 1 : 0;
}

module.exports = { assessReport };
if (require.main === module) {
  try {
    main();
  } catch {
    console.error("Dependency audit could not be completed; failing closed.");
    process.exitCode = 1;
  }
}
