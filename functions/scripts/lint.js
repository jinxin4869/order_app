const { ESLint } = require("eslint");
const path = require("path");
(async () => {
  const eslint = new ESLint({
    useEslintrc: false,
    overrideConfigFile: path.join(__dirname, "../.eslintrc.js"),
  });
  const results = await eslint.lintFiles([
    "src/**/*.js",
    "test-support/**/*.js",
  ]);
  const formatter = await eslint.loadFormatter("stylish");
  const output = formatter.format(results);
  if (output) process.stdout.write(output);
  process.exitCode = results.some((result) => result.errorCount) ? 1 : 0;
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
