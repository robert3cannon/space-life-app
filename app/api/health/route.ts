import { RESTAURANT_CHAINS } from "@/data/restaurant-foods";
import { json } from "@/lib/api";
import { getSql } from "@/lib/db";

export async function GET() {
  const items = RESTAURANT_CHAINS.reduce((count, chain) => count + chain.items.length, 0);
  const thirdParty = RESTAURANT_CHAINS.filter((chain) => chain.sourceType === "third-party").length;
  try {
    await getSql()`select 1 as ok`;
    return json({ ok: true, foodCatalog: { chains: RESTAURANT_CHAINS.length, items, thirdParty } });
  } catch {
    return json({ ok: false }, 503);
  }
}

export const dynamic = "force-dynamic";
