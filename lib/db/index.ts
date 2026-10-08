import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./url";

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

export function getSql() {
  if (!globalForDb.sql) {
    const { url } = resolveDatabaseUrl(process.env, "app");
    globalForDb.sql = postgres(url, { prepare: false, max: 5 });
  }
  return globalForDb.sql;
}

export function getDb() {
  if (!globalForDb.db) globalForDb.db = drizzle(getSql(), { schema });
  return globalForDb.db;
}

export async function closeDb() {
  if (globalForDb.sql) {
    await globalForDb.sql.end({ timeout: 5 });
  }
  globalForDb.sql = undefined;
  globalForDb.db = undefined;
}
