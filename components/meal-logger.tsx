"use client";

import { useEffect, useRef, useState } from "react";
import { MEAL_META } from "@/lib/constants";
import { api } from "@/lib/client";
import { round1, scaleListedFood, type FoodHit, type FoodNutrients } from "@/lib/food-catalog";
import { getZonedParts } from "@/lib/time";
import type { MealDto, MealItemDto, MealType } from "@/lib/types";
import { BarcodeScan } from "./barcode-scan";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

type CartLine = {
  key: string;
  id?: string;
  name: string;
  brand: string | null;
  hit: FoodHit | null;
  servingIndex: number;
  quantity: string;
  base: FoodNutrients;
  grams: number | null;
  servingLabel: string | null;
  sourceId: string | null;
};

function slotForNow(): MealType {
  const hour = getZonedParts(new Date()).hour;
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function nutrientsFor(line: CartLine): FoodNutrients {
  const qty = Number(line.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  if (line.hit) {
    const serving = line.hit.servings[line.servingIndex] ?? line.hit.servings[0];
    if (serving) return scaleListedFood(line.hit, serving.grams, qty);
  }
  return {
    calories: Math.max(0, Math.round(line.base.calories * qty)),
    proteinG: Math.max(0, round1(line.base.proteinG * qty)),
    carbsG: Math.max(0, round1(line.base.carbsG * qty)),
    fatG: Math.max(0, round1(line.base.fatG * qty)),
  };
}

function lineFromItem(item: MealItemDto): CartLine {
  const qty = item.quantity > 0 ? item.quantity : 1;
  return {
    key: item.id,
    id: item.id,
    name: item.name,
    brand: item.brand,
    hit: null,
    servingIndex: 0,
    quantity: String(qty),
    base: {
      calories: item.calories / qty,
      proteinG: item.proteinG / qty,
      carbsG: item.carbsG / qty,
      fatG: item.fatG / qty,
    },
    grams: item.grams,
    servingLabel: item.servingLabel,
    sourceId: item.sourceId,
  };
}

function lineFromHit(hit: FoodHit): CartLine {
  const serving = hit.servings[0];
  const nutrients = serving
    ? scaleListedFood(hit, serving.grams, 1)
    : { calories: hit.calories, proteinG: hit.proteinG, carbsG: hit.carbsG, fatG: hit.fatG };
  return {
    key: crypto.randomUUID(),
    name: hit.name.slice(0, 160),
    brand: hit.brand,
    hit,
    servingIndex: 0,
    quantity: "1",
    base: nutrients,
    grams: serving?.grams ?? null,
    servingLabel: serving?.label ?? null,
    sourceId: hit.id,
  };
}

export function MealLogger({
  open,
  date,
  places,
  meal,
  onClose,
  onSaved,
}: {
  open: boolean;
  date: string;
  places: string[];
  meal: MealDto | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [step, setStep] = useState<"place" | "items">("place");
  const [place, setPlace] = useState("");
  const [slot, setSlot] = useState<MealType>("snack");
  const [time, setTime] = useState("12:00");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [customCalories, setCustomCalories] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchGen = useRef(0);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setStep(meal ? "items" : "place");
    setPlace(meal?.place ?? "");
    setSlot(meal?.meal ?? slotForNow());
    setTime(meal ? getZonedParts(new Date(meal.loggedAt)).time : getZonedParts(new Date()).time);
    setCart(meal ? meal.items.map(lineFromItem) : []);
    setQuery("");
    setHits([]);
    setSearchNote(null);
    setCustomCalories("");
    setScanning(false);
    setError(null);
  }, [open, meal]);

  useEffect(() => {
    if (!open || step !== "items" || scanning) return;
    const text = query.trim();
    if (text.length < 2) {
      setHits([]);
      setSearchNote(null);
      return;
    }
    const gen = ++searchGen.current;
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        setSearchNote(null);
        try {
          const placeParam = place.trim() ? `&place=${encodeURIComponent(place.trim())}` : "";
          const result = await api<{ foods: FoodHit[] }>(`/api/food/search?q=${encodeURIComponent(text)}&limit=6${placeParam}`);
          if (gen !== searchGen.current) return;
          setHits(result.foods);
          setSearchNote(result.foods.length ? null : "No database match. Add it with the calories you have.");
        } catch (err) {
          if (gen !== searchGen.current) return;
          setHits([]);
          setSearchNote(err instanceof Error ? err.message : "Search failed");
        } finally {
          if (gen === searchGen.current) setSearching(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(handle);
  }, [open, place, query, scanning, step]);

  function addHit(hit: FoodHit) {
    setCart((lines) => [...lines, lineFromHit(hit)]);
    setQuery("");
    setHits([]);
    setSearchNote(null);
    setCustomCalories("");
  }

  function addCustom() {
    const calories = Number(customCalories);
    const name = query.trim();
    if (!name || !Number.isFinite(calories) || calories < 0) {
      setError("Enter a name and calories to add it");
      return;
    }
    setCart((lines) => [
      ...lines,
      {
        key: crypto.randomUUID(),
        name: name.slice(0, 160),
        brand: null,
        hit: null,
        servingIndex: 0,
        quantity: "1",
        base: { calories, proteinG: 0, carbsG: 0, fatG: 0 },
        grams: null,
        servingLabel: null,
        sourceId: null,
      },
    ]);
    setQuery("");
    setHits([]);
    setSearchNote(null);
    setCustomCalories("");
    setError(null);
  }

  async function lookupCode(code: string) {
    setScanning(false);
    setLookingUp(true);
    setError(null);
    try {
      const result = await api<{ food: FoodHit }>(`/api/food/barcode?code=${encodeURIComponent(code)}`);
      addHit(result.food);
      toast(`Added ${result.food.name}`);
    } catch (err) {
      setSearchNote(err instanceof Error ? err.message : "No food found for that barcode");
    } finally {
      setLookingUp(false);
    }
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((lines) => lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  const totals = cart.reduce<FoodNutrients>(
    (sum, line) => {
      const nutrients = nutrientsFor(line);
      sum.calories += nutrients.calories;
      sum.proteinG = round1(sum.proteinG + nutrients.proteinG);
      sum.carbsG = round1(sum.carbsG + nutrients.carbsG);
      sum.fatG = round1(sum.fatG + nutrients.fatG);
      return sum;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  async function save() {
    const trimmed = place.trim();
    if (!trimmed) {
      setError("Add a place");
      setStep("place");
      return;
    }
    if (!cart.length) {
      setError("Add at least one item");
      return;
    }
    const items = cart.map((line) => {
      const nutrients = nutrientsFor(line);
      const quantity = Number(line.quantity);
      const serving = line.hit ? (line.hit.servings[line.servingIndex] ?? line.hit.servings[0]) : null;
      return {
        id: line.id,
        name: line.name,
        brand: line.brand,
        calories: nutrients.calories,
        proteinG: nutrients.proteinG,
        carbsG: nutrients.carbsG,
        fatG: nutrients.fatG,
        grams: serving?.grams ?? line.grams,
        quantity,
        servingLabel: serving?.label ?? line.servingLabel,
        sourceId: line.sourceId,
      };
    });
    if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      setError("Quantity needs to be a number above 0");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { place: trimmed, meal: slot, date, time, items };
    try {
      if (meal) await api(`/api/meals/${meal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/api/meals", { method: "POST", body: JSON.stringify(payload) });
      toast(meal ? "Meal updated" : `Logged ${trimmed}`);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const title = scanning ? "Scan barcode" : step === "place" ? "Where are you?" : place.trim() || "Log a meal";

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      {scanning ? <BarcodeScan onCode={(code) => void lookupCode(code)} onCancel={() => setScanning(false)} /> : null}
      {!scanning && step === "place" ? (
        <div>
          <label className="field">
            <span>Place</span>
            <input
              data-testid="meal-place"
              value={place}
              placeholder="McDonald's, dining hall, Home…"
              onChange={(event) => setPlace(event.target.value)}
              autoFocus
            />
          </label>
          <div className="chips" style={{ marginBottom: 14 }}>
            {places.map((name) => (
              <button
                key={name}
                className={place.trim().toLowerCase() === name.toLowerCase() ? "chip on" : "chip"}
                type="button"
                onClick={() => {
                  setPlace(name);
                  setStep("items");
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <button className="btn" data-testid="meal-continue" type="button" disabled={!place.trim()} onClick={() => setStep("items")}>
            Continue
          </button>
        </div>
      ) : null}
      {!scanning && step === "items" ? (
        <div>
          <button className="text-btn" type="button" onClick={() => setStep("place")} style={{ marginBottom: 10 }}>
            {place.trim() || "Place"} · change
          </button>
          <label className="field">
            <span>Add a food</span>
            <input
              data-testid="meal-search"
              value={query}
              placeholder="Search cheeseburger, fries…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="btn-ghost" style={{ marginBottom: 12 }} type="button" onClick={() => setScanning(true)}>
            {lookingUp ? "Looking up…" : "Scan barcode"}
          </button>
          {searching ? <p className="faint">Searching…</p> : null}
          {hits.length ? (
            <div className="stack" style={{ marginBottom: 12 }}>
              {hits.map((hit) => (
                <button key={hit.id} className="event" type="button" onClick={() => addHit(hit)}>
                  <time className="num">{hit.calories}</time>
                  <div>
                    <strong>
                      {hit.name}
                      {hit.brand ? <em className="pill" data-type="meal">{hit.brand}</em> : null}
                    </strong>
                    <span>{hit.source === "usda" ? "USDA" : hit.source === "restaurant" ? "Restaurant" : "Open Food Facts"} · {hit.servings[0]?.label}</span>
                    {hit.note ? <span className="food-note">{hit.note}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          {searchNote ? <p className="muted" style={{ marginTop: 0 }}>{searchNote}</p> : null}
          {searchNote && query.trim().length >= 2 ? (
            <div className="grid-2">
              <label className="field">
                <span>Calories</span>
                <input inputMode="numeric" value={customCalories} onChange={(event) => setCustomCalories(event.target.value)} />
              </label>
              <div className="field">
                <span>&nbsp;</span>
                <button className="btn-ghost" type="button" onClick={addCustom}>Add to meal</button>
              </div>
            </div>
          ) : null}
          <div className="section-title">
            <h2>In this meal</h2>
            <span className="faint">{cart.length} {cart.length === 1 ? "item" : "items"}</span>
          </div>
          <div className="stack" data-testid="meal-cart" style={{ marginBottom: 8 }}>
            {cart.length === 0 ? <p className="faint">Search and add foods one at a time.</p> : null}
            {cart.map((line) => {
              const nutrients = nutrientsFor(line);
              return (
                <div key={line.key} className="meal-line cart-line" data-testid="cart-item">
                  <div>
                    <strong>{line.name}</strong>
                    <span>
                      {line.brand ? `${line.brand} · ` : ""}
                      {nutrients.calories} kcal · {nutrients.proteinG}p · {nutrients.carbsG}c · {nutrients.fatG}f
                    </span>
                    {line.hit && line.hit.servings.length > 1 ? (
                      <label className="field" style={{ marginTop: 8 }}>
                        <span>Serving</span>
                        <select
                          value={line.servingIndex}
                          onChange={(event) => {
                            const index = Number(event.target.value);
                            const serving = line.hit?.servings[index];
                            updateLine(line.key, {
                              servingIndex: index,
                              grams: serving?.grams ?? line.grams,
                              servingLabel: serving?.label ?? line.servingLabel,
                            });
                          }}
                        >
                          {line.hit.servings.map((serving, index) => (
                            <option key={`${serving.label}-${serving.grams}`} value={index}>{serving.label}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <div className="row">
                    <label className="field" style={{ margin: 0, width: 72 }}>
                      <span>Qty</span>
                      <input
                        aria-label={`${line.name} quantity`}
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                      />
                    </label>
                    <button className="text-btn" type="button" aria-label={`Remove ${line.name}`} onClick={() => setCart((lines) => lines.filter((item) => item.key !== line.key))}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="meal-total" data-testid="meal-total">
            <span>{totals.proteinG}p · {totals.carbsG}c · {totals.fatG}f</span>
            <b className="num">{totals.calories} kcal</b>
          </div>
          <div className="grid-2">
            <label className="field">
              <span>Meal</span>
              <select value={slot} onChange={(event) => setSlot(event.target.value as MealType)}>
                {Object.entries(MEAL_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Time</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
            </label>
          </div>
          {error ? <p className="err">{error}</p> : null}
          <button className="btn" data-testid="meal-save" type="button" disabled={saving || cart.length === 0} onClick={() => void save()}>
            {saving ? "Saving…" : meal ? "Save meal" : "Save"}
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}
