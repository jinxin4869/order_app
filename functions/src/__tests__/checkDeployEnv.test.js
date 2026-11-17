const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  checkDeployEnv,
  readEnvFiles,
} = require("../../scripts/check-deploy-env");

const script = path.join(__dirname, "../../scripts/check-deploy-env.js");
const all = (value) =>
  [
    `ENFORCE_APP_CHECK=${value}`,
    `ENFORCE_ORDER_LIMITS=${value}`,
    `ENFORCE_TABLE_TOKEN=${value}`,
  ].join("\n");
const check = (files) => checkDeployEnv(files, "demo-project");

test("a clone without functions/.env is rejected for all three settings", () => {
  const { errors } = check({});
  expect(errors).toHaveLength(3);
  expect(errors.join("\n")).toMatch(/ENFORCE_APP_CHECK が未設定/);
  expect(errors.join("\n")).toMatch(/ENFORCE_ORDER_LIMITS が未設定/);
  expect(errors.join("\n")).toMatch(/ENFORCE_TABLE_TOKEN が未設定/);
});
test("one missing setting is enough to reject", () => {
  const { errors } = check({
    ".env": "ENFORCE_APP_CHECK=true\nENFORCE_ORDER_LIMITS=false\n",
  });
  expect(errors).toEqual([
    expect.stringMatching(/^ENFORCE_TABLE_TOKEN が未設定/),
  ]);
});
test.each(["true", "false"])("all three set to %s pass", (value) => {
  expect(check({ ".env": all(value) })).toEqual({
    errors: [],
    values: {
      ENFORCE_APP_CHECK: value,
      ENFORCE_ORDER_LIMITS: value,
      ENFORCE_TABLE_TOKEN: value,
    },
    overrides: [],
  });
});
test("the settings may differ from each other", () => {
  const { errors, values } = check({
    ".env":
      "# comment\nENFORCE_APP_CHECK=true\r\nexport ENFORCE_ORDER_LIMITS = false \nENFORCE_TABLE_TOKEN=false\nORDER_LIMIT_PER_TABLE=10\n",
  });
  expect(errors).toEqual([]);
  expect(values).toEqual({
    ENFORCE_APP_CHECK: "true",
    ENFORCE_ORDER_LIMITS: "false",
    ENFORCE_TABLE_TOKEN: "false",
  });
});
// The runtime treats every one of these as "not enforced" without a warning.
test.each(["", "TRUE", "True", "1", "yes", "on", '"true"', "true # on"])(
  "a value other than true or false is rejected (%j)",
  (value) => {
    const { errors } = check({ ".env": all(value) });
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain("functions/.env: ENFORCE_APP_CHECK=");
  }
);
test("a commented-out line does not count as set", () => {
  expect(
    check({ ".env": all("true").replace(/^/gm, "# ") }).errors
  ).toHaveLength(3);
});
test("the last line for a key is the one that counts", () => {
  expect(
    check({ ".env": `${all("true")}\nENFORCE_APP_CHECK=maybe\n` }).errors
  ).toHaveLength(1);
});
test("the project file overrides .env and can supply missing settings", () => {
  const { errors, values } = check({
    ".env": "ENFORCE_APP_CHECK=false\nENFORCE_ORDER_LIMITS=false\n",
    ".env.demo-project": "ENFORCE_APP_CHECK=true\nENFORCE_TABLE_TOKEN=true\n",
  });
  expect(errors).toEqual([]);
  expect(values).toEqual({
    ENFORCE_APP_CHECK: "true",
    ENFORCE_ORDER_LIMITS: "false",
    ENFORCE_TABLE_TOKEN: "true",
  });
});
test("a file for another project or an alias cannot supply a missing setting", () => {
  const { errors, overrides } = check({ ".env.default": all("true") });
  expect(errors).toHaveLength(3);
  expect(overrides).toEqual([".env.default"]);
});
test("a file for an alias is reported, and its values must be valid too", () => {
  const files = { ".env": all("false"), ".env.default": all("true") };
  expect(check(files)).toMatchObject({
    errors: [],
    overrides: [".env.default"],
  });
  files[".env.default"] = "ENFORCE_APP_CHECK=TRUE\n";
  expect(check(files).errors).toEqual([
    expect.stringContaining("functions/.env.default: ENFORCE_APP_CHECK=TRUE"),
  ]);
});

describe("the script", () => {
  let dir;
  const run = (env = {}) => {
    try {
      return {
        status: 0,
        output: execFileSync(
          process.execPath,
          [path.join(dir, "scripts/check.js")],
          {
            env: { PATH: process.env.PATH, ...env },
            encoding: "utf8",
            stdio: "pipe",
          }
        ),
      };
    } catch (error) {
      return { status: error.status, output: error.stderr };
    }
  };
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "order-app-deploy-env-"));
    fs.mkdirSync(path.join(dir, "scripts"));
    fs.copyFileSync(script, path.join(dir, "scripts/check.js"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("ignores the template, the emulator file and the shell environment", () => {
    fs.writeFileSync(path.join(dir, ".env.example"), all("false"));
    fs.writeFileSync(path.join(dir, ".env.local"), all("false"));
    expect(readEnvFiles(dir)).toEqual({});
    const { status, output } = run({
      ENFORCE_APP_CHECK: "true",
      ENFORCE_ORDER_LIMITS: "true",
      ENFORCE_TABLE_TOKEN: "true",
    });
    expect(status).toBe(1);
    expect(output).toContain("デプロイできません");
  });
  test("passes and prints the values when all three are explicit", () => {
    fs.writeFileSync(path.join(dir, ".env"), all("false"));
    expect(run()).toEqual({
      status: 0,
      output:
        "Functions の強制スイッチ: ENFORCE_APP_CHECK=false ENFORCE_ORDER_LIMITS=false ENFORCE_TABLE_TOKEN=false\n",
    });
  });
  test("reads the project file named by GCLOUD_PROJECT", () => {
    fs.writeFileSync(path.join(dir, ".env.demo-project"), all("true"));
    expect(run().status).toBe(1);
    expect(run({ GCLOUD_PROJECT: "demo-project" }).status).toBe(0);
  });
});
