import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cleanDatabaseUrl, resolveDatabaseUrl } from "../lib/db/url";

test("app prefers DATABASE_URL and falls back to POSTGRES_URL", () => {
  const pooled = "postgresql://user:p%40ss@ep-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const legacy = "postgresql://user:secret@ep-old.neon.tech/stale?sslmode=require";
  const chosen = resolveDatabaseUrl({ DATABASE_URL: pooled, POSTGRES_URL: legacy }, "app");
  assert.equal(chosen.source, "DATABASE_URL");
  assert.equal(chosen.url.includes("channel_binding"), false);
  assert.equal(chosen.url.includes("ep-pooler"), true);
  assert.equal(chosen.url.includes("sslmode=require"), true);

  const fallback = resolveDatabaseUrl({ POSTGRES_URL: legacy }, "app");
  assert.equal(fallback.source, "POSTGRES_URL");
  assert.equal(fallback.url.includes("/stale"), true);
});

test("migrations use the unpooled Neon URL", () => {
  const pooled = "postgresql://user:secret@ep-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true";
  const direct = "postgresql://user:secret@ep-direct.us-east-2.aws.neon.tech/neondb?sslmode=require";
  const chosen = resolveDatabaseUrl(
    { DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct, POSTGRES_URL: pooled },
    "migrate",
  );
  assert.equal(chosen.source, "DATABASE_URL_UNPOOLED");
  assert.equal(chosen.url.includes("ep-direct"), true);
  assert.equal(chosen.url.includes("pgbouncer"), false);
});

test("migrations fall back to the pooled URL locally", () => {
  const local = "postgres://orbit:orbit@localhost:5432/orbit";
  const chosen = resolveDatabaseUrl({ DATABASE_URL: local }, "migrate");
  assert.equal(chosen.source, "DATABASE_URL");
  assert.equal(chosen.url, local);
});

test("Neon hosts without sslmode get sslmode=require", () => {
  const cleaned = cleanDatabaseUrl("postgres://user:secret@ep-plain.us-east-2.aws.neon.tech/neondb");
  assert.match(cleaned, /sslmode=require$/);
});

test("Hobby cron runs once per day", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
  assert.equal(vercel.crons.length, 1);
  assert.equal(vercel.crons[0].path, "/api/cron/dispatch");
  assert.match(vercel.crons[0].schedule, /^0 \d{1,2} \* \* \*$/);
});
