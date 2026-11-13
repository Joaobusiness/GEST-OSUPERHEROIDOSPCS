// Dev Postgres (real server binaries via embedded-postgres). Prod uses DATABASE_URL on managed Postgres.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = ".pgdata";
const port = Number(process.env.PG_PORT ?? 5433);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port, persistent: true });
if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try { await pg.createDatabase("shpcs"); } catch {}
try { await pg.createDatabase("shpcs_test"); } catch {}
console.log(`postgres ready on :${port}`);
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
