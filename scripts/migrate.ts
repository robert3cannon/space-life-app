import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { resolveDatabaseUrl } from "../lib/db/url";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

function statements(sql: string) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter((part) => part && !part.split("\n").every((line) => line.trim().startsWith("--") || !line.trim()));
}

export async function migrate() {
  const { url, source } = resolveDatabaseUrl(process.env, "migrate");
  console.log(`migrations: ${source}`);
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const dir = path.join(process.cwd(), "drizzle");
    const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const applied = await sql`SELECT id FROM schema_migrations WHERE id = ${file}`;
      if (applied.length) continue;
      const body = readFileSync(path.join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        for (const statement of statements(body)) {
          await tx.unsafe(statement);
        }
        await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
      });
      console.log(`applied ${file}`);
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
