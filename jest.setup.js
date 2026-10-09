/* global jest */
jest.mock("./src/services/firebase", () => ({
  functions: {},
  auth: {},
  db: {},
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
