import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Tests create and wipe tenants: they must never touch the real (Neon) database.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || /neon\.tech/i.test(testUrl)) throw new Error("Defina TEST_DATABASE_URL apontando para um Postgres local de teste (nunca o Neon).");
process.env.DATABASE_URL = testUrl;

export default defineConfig({
  resolve: { alias: { "@": r("./src"), "server-only": r("./tests/server-only-stub.ts") } },
  test: { environment: "node", include: ["src/**/*.test.ts", "tests/**/*.test.ts"], testTimeout: 30_000, fileParallelism: false },
});
