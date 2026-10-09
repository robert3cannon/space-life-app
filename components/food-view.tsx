"use client";

import { useEffect, useState } from "react";
import { MEAL_META } from "@/lib/constants";
import { api } from "@/lib/client";
import { dayNumber, formatLongDate, formatTime, formatWeekday, round1 } from "@/lib/format";
import { addCalendarDays } from "@/lib/time";
import type { FoodDto, MealDto, MealItemDto, Targets } from "@/lib/types";
import { MealLogger } from "./meal-logger";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, Meter, PageTitle, Ring } from "./ui";

type DayPayload = {
  today: string;
  date: string;
  targets: Targets;
  totals: Targets;
  logs: FoodDto[];
  meals: MealDto[];
  recent: FoodDto[];
  recentMeals: MealDto[];
  places: string[];
};

type WeekPayload = {
  dates: string[];
  days: Array<Targets & { date: string }>;
  totals: Targets;
  targets: Targets;
};

function placeLabel(meal: MealDto) {
  return meal.place?.trim() || "Home";
}

export function FoodView() {
  const [date, setDate] = useState<string | null>(null);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [mealOpen, setMealOpen] = useState(false);
  const [editing, setEditing] = useState<MealDto | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmMeal, setConfirmMeal] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<string | null>(null);
  const toast = useToast();
  const dayPath = date ? `/api/food?date=${date}` : "/api/food";
  const day = useLoad<DayPayload>(dayPath);
  const active = day.data?.date ?? date ?? "";
  const week = useLoad<WeekPayload>(active ? `/api/food/summary?date=${active}` : "/api/food/summary");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("log") === "meal") {
      setEditing(null);
      setMealOpen(true);
    }
  }, []);

  function openLog(meal: MealDto | null = null) {
    setEditing(meal);
    setMealOpen(true);
  }

  async function refresh() {
    await day.reload();
    if (mode === "week") await week.reload();
  }

  async function relog(food: FoodDto) {
    try {
      await api("/api/food", {
        method: "POST",
        body: JSON.stringify({
          name: food.name,
          meal: food.meal,
          calories: food.calories,
          proteinG: food.proteinG,
          carbsG: food.carbsG,
          fatG: food.fatG,
        }),
      });
      toast(`Logged ${food.name}`);
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't log");
    }
  }

  async function relogMeal(meal: MealDto) {
    try {
      await api("/api/meals", {
        method: "POST",
        body: JSON.stringify({
          place: placeLabel(meal),
          meal: meal.meal,
          items: meal.items.map((item) => ({
            name: item.name,
            brand: item.brand,
            calories: item.calories,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
            grams: item.grams,
            quantity: item.quantity,
            servingLabel: item.servingLabel,
            sourceId: item.sourceId,
          })),
        }),
      });
      toast(`Logged ${placeLabel(meal)}`);
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't log");
    }
  }

  async function removeMeal(meal: MealDto) {
    if (confirmMeal !== meal.id) {
      setConfirmMeal(meal.id);
      return;
    }
    await api(`/api/meals/${meal.id}`, { method: "DELETE" });
    setConfirmMeal(null);
    if (expanded === meal.id) setExpanded(null);
    toast("Meal removed");
    await refresh();
  }

  async function removeItem(meal: MealDto, item: MealItemDto) {
    if (confirmItem !== item.id) {
      setConfirmItem(item.id);
      return;
    }
    await api(`/api/meals/${meal.id}/items/${item.id}`, { method: "DELETE" });
    setConfirmItem(null);
    toast(`Removed ${item.name}`);
    await refresh();
  }

  async function changeQty(meal: MealDto, item: MealItemDto, direction: -1 | 1) {
    const next = round1(item.quantity + direction);
    if (next <= 0 || item.quantity <= 0) return;
    const factor = next / item.quantity;
    await api(`/api/meals/${meal.id}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        quantity: next,
        calories: Math.max(0, Math.round(item.calories * factor)),
        proteinG: round1(item.proteinG * factor),
        carbsG: round1(item.carbsG * factor),
        fatG: round1(item.fatG * factor),
      }),
    });
    await refresh();
  }

  const maxBar = Math.max(1, ...(week.data?.days.map((item) => item.calories) ?? [1]));
  const meals = day.data?.meals ?? [];

  return (
    <main className="page with-fab">
      <PageTitle title="Food" />
      <p className="kicker">Intake</p>
      <div className="day-nav" data-testid="day-nav">
        <h1 className="display">{active ? formatLongDate(active).split(",")[0] : "Food"}</h1>
        <div className="row">
          <button className="btn-ghost icon-btn" type="button" aria-label="Previous day" onClick={() => active && setDate(addCalendarDays(active, -1))}>‹</button>
          <button className="btn-ghost icon-btn" type="button" aria-label="Next day" onClick={() => active && setDate(addCalendarDays(active, 1))}>›</button>
        </div>
      </div>
      <p className="sub">{active ? formatLongDate(active) : ""}</p>
      <div className="seg" style={{ marginTop: 14 }}>
        <button type="button" className={mode === "day" ? "on" : undefined} onClick={() => setMode("day")}>Day</button>
        <button type="button" className={mode === "week" ? "on" : undefined} onClick={() => setMode("week")}>Week</button>
      </div>
      {day.loading && !day.data ? <Loading /> : null}
      {day.error ? <ErrorNote message={day.error} onRetry={day.reload} /> : null}
      {day.data && mode === "day" ? (
        <>
          <section className="card">
            <div className="fuel">
              <Ring value={day.data.totals.calories} max={day.data.targets.calories} />
              <div>
                <Meter label="Protein" value={day.data.totals.proteinG} max={day.data.targets.proteinG} unit="g" tone="protein" />
                <Meter label="Carbs" value={day.data.totals.carbsG} max={day.data.targets.carbsG} unit="g" tone="carbs" />
                <Meter label="Fat" value={day.data.totals.fatG} max={day.data.targets.fatG} unit="g" tone="fat" />
              </div>
            </div>
          </section>
          <button className="btn" data-testid="log-meal" type="button" style={{ marginTop: 14 }} onClick={() => openLog(null)}>
            Log a meal
          </button>
          {day.data.recentMeals.length ? (
            <>
              <div className="section-title"><h2>Recent meals</h2></div>
              <div className="chips">
                {day.data.recentMeals.map((meal) => (
                  <button key={meal.id} className="chip" type="button" onClick={() => void relogMeal(meal)}>
                    {placeLabel(meal)} · {meal.itemCount} · {meal.totals.calories}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {day.data.recent.length ? (
            <>
              <div className="section-title"><h2>Recent foods</h2></div>
              <div className="chips">
                {day.data.recent.map((food) => (
                  <button key={food.id} className="chip" type="button" onClick={() => void relog(food)}>
                    {food.name} · {food.calories}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <div className="section-title"><h2>Meals</h2></div>
          <div className="stack">
            {meals.length === 0 ? <p className="faint">Nothing yet. Log a meal from wherever you are.</p> : null}
            {meals.map((meal) => {
              const open = expanded === meal.id;
              return (
                <article key={meal.id} className="meal-card" data-testid="meal-card" data-place={placeLabel(meal)}>
                  <button
                    className="meal-toggle"
                    type="button"
                    data-testid="meal-expand"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : meal.id)}
                  >
                    <div>
                      <strong>{placeLabel(meal)}</strong>
                      <span>
                        {formatTime(meal.loggedAt)} · {MEAL_META[meal.meal].label} · {meal.itemCount} {meal.itemCount === 1 ? "item" : "items"}
                      </span>
                      <span>{meal.totals.proteinG}p · {meal.totals.carbsG}c · {meal.totals.fatG}f</span>
                    </div>
                    <b className="meal-kcal num">{meal.totals.calories}</b>
                  </button>
                  {open ? (
                    <div className="meal-body">
                      {meal.items.map((item) => (
                        <div key={item.id} className="meal-line" data-testid="meal-item">
                          <div>
                            <strong>{item.quantity === 1 ? item.name : `${item.quantity} × ${item.name}`}</strong>
                            <span>
                              {item.brand ? `${item.brand} · ` : ""}
                              {item.calories} kcal · {item.proteinG}p · {item.carbsG}c · {item.fatG}f
                            </span>
                          </div>
                          <div className="row">
                            <button className="meal-qty" type="button" aria-label={`Less ${item.name}`} onClick={() => void changeQty(meal, item, -1)}>−</button>
                            <button className="meal-qty" type="button" aria-label={`More ${item.name}`} onClick={() => void changeQty(meal, item, 1)}>+</button>
                            <button className="text-btn" type="button" onClick={() => void removeItem(meal, item)}>
                              {confirmItem === item.id ? "Delete item?" : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="meal-actions">
                        <button className="btn-ghost" type="button" onClick={() => openLog(meal)}>Edit meal</button>
                        <button className="btn-danger" type="button" onClick={() => void removeMeal(meal)}>
                          {confirmMeal === meal.id ? "Tap again to delete" : "Delete meal"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
      {mode === "week" && week.data ? (
        <section className="card">
          <p className="kicker">This week</p>
          <h2 style={{ margin: "8px 0" }} className="num">{week.data.totals.calories} kcal</h2>
          <div className="bars" aria-hidden>
            {week.data.days.map((item) => (
              <div key={item.date}>
                <i style={{ height: `${Math.max(6, (item.calories / maxBar) * 100)}%` }} />
                <em>{formatWeekday(item.date).slice(0, 1)}</em>
              </div>
            ))}
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            {week.data.days.map((item) => (
              <button key={item.date} className="spread list-btn" type="button" onClick={() => { setDate(item.date); setMode("day"); }}>
                <span>{formatWeekday(item.date)} {dayNumber(item.date)}</span>
                <b className="num">{item.calories}</b>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {mode === "week" && week.error ? <ErrorNote message={week.error} onRetry={week.reload} /> : null}
      <button className="fab" type="button" onClick={() => openLog(null)} aria-label="Log a meal">+</button>
      <MealLogger
        open={mealOpen}
        date={day.data?.date ?? active}
        places={day.data?.places ?? ["Home"]}
        meal={editing}
        onClose={() => setMealOpen(false)}
        onSaved={refresh}
      />
    </main>
  );
}
