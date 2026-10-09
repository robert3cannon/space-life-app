import { eq } from "drizzle-orm";
import { RESTAURANT_CHAINS, searchRestaurantFoods } from "../../data/restaurant-foods";
import { getDb } from "../db";
import { foodCache } from "../db/schema";
import { HttpError } from "../errors";
import {
  foodHitLabel,
  offToHit,
  rankFoodHit,
  type FoodHit,
  type OffProduct,
  type UsdaSearchFood,
  usdaToHit,
} from "../food-catalog";

const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_TTL_MS = 15 * 60 * 1000;
const BARCODE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 6 * 60 * 60 * 1000;
const USER_AGENT = "Orbit/1.0 (personal life manager)";

type MemoryEntry = { expires: number; value: unknown };

const memory = new Map<string, MemoryEntry>();

let fetchImpl: typeof fetch = globalThis.fetch;

export function setFoodCatalogFetch(next: typeof fetch | null) {
  fetchImpl = next ?? globalThis.fetch;
  memory.clear();
}

export function usdaApiKey() {
  return process.env.USDA_API_KEY?.trim() || "DEMO_KEY";
}

async function readCache<T>(key: string): Promise<{ hit: true; value: T } | { hit: false }> {
  const now = Date.now();
  const cached = memory.get(key);
  if (cached) {
    if (cached.expires > now) return { hit: true, value: cached.value as T };
    memory.delete(key);
  }
  const [row] = await getDb().select().from(foodCache).where(eq(foodCache.cacheKey, key));
  if (!row || row.expiresAt.getTime() <= now) return { hit: false };
  remember(key, row.payload, row.expiresAt.getTime());
  return { hit: true, value: row.payload as T };
}

function remember(key: string, value: unknown, expires: number) {
  if (memory.size > 80) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(key, { expires, value });
}

async function writeCache(key: string, value: unknown, ttlMs: number) {
  const expiresAt = new Date(Date.now() + ttlMs);
  remember(key, value, expiresAt.getTime());
  await getDb()
    .insert(foodCache)
    .values({ cacheKey: key, payload: value, expiresAt })
    .onConflictDoUpdate({
      target: foodCache.cacheKey,
      set: { payload: value, expiresAt },
    });
}

async function getJson(url: string) {
  const response = await fetchImpl(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function searchUsda(query: string): Promise<{ foods: FoodHit[]; partial: boolean }> {
  async function page(dataTypes: string[], pageSize: string) {
    const params = new URLSearchParams({
      api_key: usdaApiKey(),
      query,
      pageSize,
    });
    for (const dataType of dataTypes) params.append("dataType", dataType);
    const body = (await getJson(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`)) as {
      foods?: UsdaSearchFood[];
    };
    return (body.foods ?? []).map(usdaToHit).filter((hit): hit is FoodHit => Boolean(hit));
  }
  let failed = 0;
  const load = (types: string[], pageSize: string) =>
    page(types, pageSize).catch(() => {
      failed += 1;
      return [] as FoodHit[];
    });
  const [generic, branded] = await Promise.all([load(["Foundation", "SR Legacy", "Survey (FNDDS)"], "8"), load(["Branded"], "8")]);
  if (failed === 2) throw new Error("usda");
  return { foods: [...generic, ...branded], partial: failed > 0 };
}

async function searchOff(query: string): Promise<FoodHit[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "8",
    fields: "code,product_name,brands,serving_size,nutriments",
  });
  const body = (await getJson(`https://world.openfoodfacts.org/cgi/search.pl?${params}`)) as {
    products?: OffProduct[];
  };
  return (body.products ?? []).map(offToHit).filter((hit): hit is FoodHit => Boolean(hit));
}

function withoutGeneric(hit: FoodHit): FoodHit {
  const copy = { ...hit };
  delete copy.generic;
  return copy;
}

function mergeHits(query: string, lists: FoodHit[][]) {
  const byKey = new Map<string, FoodHit>();
  for (const hit of lists.flat()) {
    const key = foodHitLabel(hit).toLowerCase();
    const current = byKey.get(key);
    if (!current || rankFoodHit(hit, query) > rankFoodHit(current, query)) byKey.set(key, hit);
  }
  return [...byKey.values()]
    .map((hit) => ({ hit, score: rankFoodHit(hit, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => withoutGeneric(item.hit));
}

function catalogStamp() {
  const items = RESTAURANT_CHAINS.reduce((count, chain) => count + chain.items.length, 0);
  return `${RESTAURANT_CHAINS.length}.${items}`;
}

/** A cached row from before sourceType, or from an older catalog, must not be served. */
function cacheIsCurrent(foods: FoodHit[]) {
  return foods.every((hit) => hit.source !== "restaurant" || hit.sourceType === "official" || hit.sourceType === "third-party");
}

export async function searchFoods(query: string, limit = 8, place?: string): Promise<FoodHit[]> {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 80) throw new HttpError("Enter at least 2 characters", 400);
  const safeLimit = Math.min(15, Math.max(1, limit));
  const placeKey = (place ?? "").trim().toLowerCase();
  const key = `search:v8:${catalogStamp()}:${placeKey}:${q.toLowerCase()}`;
  const cached = await readCache<FoodHit[]>(key);
  if (cached.hit && cacheIsCurrent(cached.value)) return cached.value.slice(0, safeLimit);

  const curated = searchRestaurantFoods(q, place);
  let usdaFailed = false;
  const usda = await searchUsda(q).catch(() => {
    usdaFailed = true;
    return { foods: [] as FoodHit[], partial: true };
  });
  const off = await searchOff(q).catch(() => [] as FoodHit[]);
  if (curated.length === 0 && usdaFailed && usda.foods.length === 0 && off.length === 0) {
    throw new HttpError("Food search is unavailable right now", 503);
  }
  const curatedLabels = new Set(curated.map((hit) => foodHitLabel(hit).toLowerCase()));
  const foods = [...curated, ...mergeHits(q, [usda.foods, off]).filter((hit) => !curatedLabels.has(foodHitLabel(hit).toLowerCase()))].slice(0, 15);
  const partial = usdaFailed || usda.partial;
  await writeCache(key, foods, foods.length && !partial ? SEARCH_TTL_MS : EMPTY_TTL_MS);
  return foods.slice(0, safeLimit);
}

async function lookupOffBarcode(code: string) {
  const body = (await getJson(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,brands,serving_size,nutriments,status`,
  )) as { status?: number; product?: OffProduct };
  if (body.status !== 1 || !body.product) return null;
  return offToHit({ ...body.product, code: body.product.code || code });
}

async function lookupUsdaBarcode(code: string) {
  const params = new URLSearchParams({
    api_key: usdaApiKey(),
    query: code,
    pageSize: "5",
    dataType: "Branded",
  });
  const body = (await getJson(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`)) as {
    foods?: UsdaSearchFood[];
  };
  const foods = body.foods ?? [];
  const exact = foods.find((food) => {
    const gtin = (food.gtinUpc ?? "").replace(/\D/g, "");
    if (!gtin) return false;
    const bare = code.replace(/^0+/, "");
    return gtin === code || gtin === bare || gtin.endsWith(bare);
  });
  return exact ? usdaToHit(exact) : null;
}

export async function lookupBarcode(code: string): Promise<FoodHit> {
  const digits = code.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) throw new HttpError("Enter a barcode of 8 to 14 digits", 400);
  const key = `barcode:v1:${digits}`;
  const cached = await readCache<{ food: FoodHit | null }>(key);
  if (cached.hit) {
    if (!cached.value.food) throw new HttpError("No food found for that barcode", 404);
    return cached.value.food;
  }
  const off = await lookupOffBarcode(digits).catch(() => null);
  const alt = !off && digits.length === 13 && digits.startsWith("0") ? await lookupOffBarcode(digits.slice(1)).catch(() => null) : null;
  const found = off ?? alt ?? (await lookupUsdaBarcode(digits).catch(() => null));
  const food = found ? withoutGeneric(found) : null;
  if (!food) {
    await writeCache(key, { food: null }, MISS_TTL_MS);
    throw new HttpError("No food found for that barcode", 404);
  }
  await writeCache(key, { food }, BARCODE_TTL_MS);
  return food;
}
