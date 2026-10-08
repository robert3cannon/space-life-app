import { desc } from "drizzle-orm";
import { getDb } from "../db";
import { activity } from "../db/schema";
import type { ActivityDto } from "../types";

function serialize(row: typeof activity.$inferSelect): ActivityDto {
  return {
    id: row.id,
    source: row.source as ActivityDto["source"],
    author: row.author,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function addActivity(input: {
  source: ActivityDto["source"];
  author?: string | null;
  message: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(activity)
    .values({
      source: input.source,
      author: input.author ?? null,
      message: input.message,
    })
    .returning();
  return serialize(row);
}

export async function listActivity(limit: number) {
  const db = getDb();
  const rows = await db.select().from(activity).orderBy(desc(activity.createdAt)).limit(limit);
  return rows.map(serialize);
}
