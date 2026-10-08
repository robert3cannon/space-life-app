import { json } from "@/lib/api";
import { getSql } from "@/lib/db";

export async function GET() {
  try {
    await getSql()`select 1 as ok`;
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 503);
  }
}

export const dynamic = "force-dynamic";
