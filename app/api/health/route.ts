import { NextResponse } from "next/server";
import { RESTAURANT_CHAINS } from "@/data/restaurant-foods";
import { getSql } from "@/lib/db";

function healthJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET() {
  const items = RESTAURANT_CHAINS.reduce((count, chain) => count + chain.items.length, 0);
  const thirdParty = RESTAURANT_CHAINS.filter((chain) => chain.sourceType === "third-party").length;
  try {
    await getSql()`select 1 as ok`;
    return healthJson({ ok: true, foodCatalog: { chains: RESTAURANT_CHAINS.length, items, thirdParty } });
  } catch {
    return healthJson({ ok: false }, 503);
  }
}

export const dynamic = "force-dynamic";
