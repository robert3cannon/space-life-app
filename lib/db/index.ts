import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!globalForDb.sql) {
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
