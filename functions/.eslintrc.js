module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022 },
  extends: ["eslint:recommended"],
  ignorePatterns: ["node_modules/", ".firebase/", "*.log"],
  rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  overrides: [
    { files: ["src/**/__tests__/**", "test-support/**"], env: { jest: true } },
  ],
};
