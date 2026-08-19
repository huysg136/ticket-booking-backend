/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  testTimeout: 30000,
  maxWorkers: 1,
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
};
