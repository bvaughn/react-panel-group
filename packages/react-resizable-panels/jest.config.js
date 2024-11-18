/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  testEnvironment: "jsdom",
  preset: "ts-jest",
  prettierPath: null,
  testEnvironmentOptions: {
    customExportConditions: ["development"],
  },
  testMatch: ["**/*.test.{ts,tsx}"],
};
