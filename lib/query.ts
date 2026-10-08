import { HttpError } from "./errors";
import { todayDateString, zonedDayRange, zonedWeekRange } from "./time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function requireDate(value: string | null, fallback?: string) {
  if (!value) {
    if (fallback) return fallback;
    throw new HttpError("Missing date", 400);
  }
  if (!DATE_RE.test(value)) throw new HttpError("Invalid date", 400);
  return value;
}

export function parseInstant(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(`Invalid ${label}`, 400);
  return date;
}

export function parseRange(url: URL, now = new Date()) {
  const today = todayDateString(now);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  if (fromParam || toParam) {
    if (!fromParam || !toParam) throw new HttpError("Provide both from and to", 400);
    const from = parseInstant(fromParam, "from");
    const to = parseInstant(toParam, "to");
    if (to <= from) throw new HttpError("to must be after from", 400);
    if (to.getTime() - from.getTime() > 62 * 24 * 60 * 60 * 1000) {
      throw new HttpError("Range is too large", 400);
    }
    return { today, from, to, mode: "range" as const };
  }
  const date = requireDate(url.searchParams.get("date") ?? url.searchParams.get("weekOf"), today);
  if (url.searchParams.get("date") && !url.searchParams.get("weekOf")) {
    const range = zonedDayRange(date);
    return { today, date, ...range, dates: [date], startDate: date, mode: "day" as const };
  }
  const week = zonedWeekRange(date);
  return { today, date, ...week, mode: "week" as const };
}

export function limitParam(url: URL, fallback: number, max: number) {
  const raw = url.searchParams.get("limit");
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new HttpError("Invalid limit", 400);
  return Math.min(value, max);
}
