const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required. Point it to a dedicated test database.");
  process.exit(1);
}

let databaseName = "";
try {
  databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
} catch {
  console.error("DATABASE_URL is invalid.");
  process.exit(1);
}

if (!/test/i.test(databaseName)) {
  console.error(
    `Refusing to run destructive integration tests against database "${databaseName}". ` +
      'Use a dedicated database whose name contains "test".',
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [require.resolve("jest/bin/jest"), "--runInBand", "tests/booking.integration.test.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, RUN_INTEGRATION_TESTS: "true" },
  },
);

process.exit(result.status ?? 1);
