module.exports = {
  /* Converted for compatibility with flat config: avoid using `env` key. */
  parserOptions: {
    ecmaVersion: 2020,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  extends: ["eslint:recommended", "google", "plugin:prettier/recommended"],
  ignorePatterns: ["node_modules/", ".firebase/", "*.log"],
  rules: {
    "prettier/prettier": "error",
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    quotes: ["error", "double", { allowTemplateLiterals: true }],
    "no-undef": "off",
    "no-unused-vars": ["error", { argsIgnorePattern: "^context$" }],
  },
  overrides: [
    {
      files: ["**/*.spec.*", "**/*.test.*", "**/__tests__/**"],
      /* Provide Jest globals instead of `env` to avoid flat-config errors */
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
      },
      rules: {},
    },
  ],
  globals: {
    exports: "writable",
    module: "writable",
    require: "readonly",
    process: "readonly",
    __dirname: "readonly",
    __filename: "readonly",
    global: "readonly",
  },
};
