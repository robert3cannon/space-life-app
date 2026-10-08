import { TIMEZONE } from "./constants";

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
  date: string;
  time: string;
};

export function getZonedParts(date: Date, tz = TIMEZONE): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const minute = Number(bag.minute);
  const second = Number(bag.second);
  const year = Number(bag.year);
  const month = Number(bag.month);
  const day = Number(bag.day);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: bag.weekday ?? "",
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function zoneOffsetMs(date: Date, tz: string) {
  const parts = getZonedParts(date, tz);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

/** Interpret a wall-clock date and time in `tz` as an absolute instant. */
export function zonedDateTimeToUtc(date: string, time: string, tz = TIMEZONE): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !clock) throw new Error("Invalid date or time");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = zoneOffsetMs(utcGuess, tz);
  let result = new Date(utcGuess.getTime() - offset);
  const offsetAtResult = zoneOffsetMs(result, tz);
  if (offsetAtResult !== offset) {
    result = new Date(utcGuess.getTime() - offsetAtResult);
  }
  return result;
}

export function addCalendarDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday-based week containing `dateStr`. */
export function weekStartDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addCalendarDays(dateStr, delta);
}

export function todayDateString(now = new Date(), tz = TIMEZONE) {
  return getZonedParts(now, tz).date;
}

export function zonedDayRange(dateStr: string, tz = TIMEZONE) {
  return {
    from: zonedDateTimeToUtc(dateStr, "00:00", tz),
    to: zonedDateTimeToUtc(addCalendarDays(dateStr, 1), "00:00", tz),
  };
}

export function zonedWeekRange(dateStr: string, tz = TIMEZONE) {
  const startDate = weekStartDate(dateStr);
  const dates = Array.from({ length: 7 }, (_, index) => addCalendarDays(startDate, index));
  return {
    startDate,
    dates,
    from: zonedDateTimeToUtc(startDate, "00:00", tz),
    to: zonedDateTimeToUtc(addCalendarDays(startDate, 7), "00:00", tz),
  };
}

export function calendarWeekday(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
