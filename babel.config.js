module.exports = function (api) {
  const isTest = api.env("test");
  return {
    presets: ["babel-preset-expo"],
    // Tests never read local environment files or initialize a real Firebase app.
    plugins: isTest
      ? []
      : [
          [
            "module:react-native-dotenv",
            {
              moduleName: "@env",
              path: ".env",
              blacklist: null,
              whitelist: null,
              safe: false,
              allowUndefined: true,
            },
          ],
        ],
  };
};
