const POOLED = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL"] as const;
const DIRECT = ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"] as const;

export type DatabaseUrl = { url: string; source: string };

function first(env: NodeJS.ProcessEnv, keys: readonly string[]) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return { key, value };
  }
  return null;
}

/** Drop client-only query params. postgres.js forwards unknown ones as server settings, and Neon strings include channel_binding and pgbouncer. */
export function cleanDatabaseUrl(raw: string) {
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) {
    if (key !== "sslmode") url.searchParams.delete(key);
  }
  if (url.hostname.endsWith(".neon.tech") && !url.searchParams.get("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv, purpose: "app" | "migrate"): DatabaseUrl {
  const pooled = first(env, POOLED);
  const direct = first(env, DIRECT);
  const chosen = purpose === "migrate" ? direct || pooled : pooled || direct;
  if (!chosen) {
    throw new Error("DATABASE_URL is not set. The Neon integration also accepts POSTGRES_URL.");
  }
  return { url: cleanDatabaseUrl(chosen.value), source: chosen.key };
}
