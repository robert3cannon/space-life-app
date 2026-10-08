import { TIMEZONE } from "./constants";
import { getZonedParts, todayDateString, zonedDateTimeToUtc } from "./time";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export type HealthDayMetrics = {
  date: string;
  steps: number | null;
  activeKcal: number | null;
  restingKcal: number | null;
  exerciseMinutes: number | null;
  restingHr: number | null;
  dietaryWaterOz: number | null;
  present: {
    steps: boolean;
    activeKcal: boolean;
    restingKcal: boolean;
    exerciseMinutes: boolean;
    restingHr: boolean;
    dietaryWaterOz: boolean;
  };
};

export type ParsedWorkout = {
  key: string;
  type: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  calories: number | null;
  distance: string | null;
};

export type ParsedNight = {
  wakeDate: string;
  bedtime: Date;
  wakeAt: Date;
  durationMinutes: number;
};

export type ParsedWeight = {
  measuredAt: Date;
  pounds: number;
};

export type ParsedHealth = {
  days: HealthDayMetrics[];
  workouts: ParsedWorkout[];
  nights: ParsedNight[];
  weights: ParsedWeight[];
};

type MetricField = "steps" | "activeKcal" | "restingKcal" | "exerciseMinutes" | "restingHr" | "dietaryWaterOz";

type Bucket = {
  date: string;
  values: Partial<Record<MetricField, number>>;
  seen: Set<MetricField>;
  totals: Set<MetricField>;
};

const FIELD_KEYS: Record<MetricField, Set<string>> = {
  steps: new Set(["steps", "stepcount", "step"]),
  activeKcal: new Set(["activeenergy", "activekcal", "activeenergyburned", "activecalories"]),
  restingKcal: new Set(["restingenergy", "basalenergy", "basalenergyburned", "restingcalories"]),
  exerciseMinutes: new Set(["exerciseminutes", "exercisetime", "appleexercisetime", "appleexercise"]),
  restingHr: new Set(["restingheartrate", "restinghr"]),
  dietaryWaterOz: new Set(["dietarywater", "water", "waterintake"]),
};

const DATE_KEYS = new Set(["date", "day"]);
const WORKOUT_KEYS = new Set(["workouts", "workout"]);
const SLEEP_KEYS = new Set(["sleep", "sleepanalysis", "sleeps"]);
const WEIGHT_LIST_KEYS = new Set(["weights", "weightsamples"]);
const WEIGHT_KEYS = new Set(["weight", "bodymass"]);
const DAY_LIST_KEYS = new Set(["days"]);

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function cleanText(value: string) {
  return value.replace(/\u00a0|\u202f/g, " ").replace(/\s+/g, " ").trim();
}

function fields(record: Record<string, unknown>) {
  const bag = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    bag.set(key.toLowerCase().replace(/[^a-z0-9]/g, ""), value);
  }
  return bag;
}

function fieldOf(record: Record<string, unknown>, names: string[]) {
  const bag = fields(record);
  for (const name of names) {
    if (bag.has(name)) return bag.get(name);
  }
  return undefined;
}

function normalizeNumber(raw: string) {
  let text = raw.trim();
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, "");
  else if (/^[+-]?\d+,\d{1,2}$/.test(text)) text = text.replace(",", ".");
  else text = text.replace(/,/g, "");
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function parseQuantity(input: unknown): { value: number; unit: string } | null {
  if (typeof input === "number" && Number.isFinite(input)) return { value: input, unit: "" };
  if (typeof input === "string") {
    const cleaned = cleanText(input);
    if (!cleaned || cleaned === "-" || cleaned === "—" || /^n\/?a$/i.test(cleaned)) return null;
    const match = /^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)\s*(.*)$/.exec(cleaned);
    if (!match) return null;
    const value = normalizeNumber(match[1]);
    if (value == null) return null;
    return { value, unit: match[2].trim().toLowerCase() };
  }
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const bag = fields(input as Record<string, unknown>);
    const raw = bag.get("value") ?? bag.get("quantity") ?? bag.get("qty") ?? bag.get("amount");
    const unitRaw = bag.get("unit") ?? bag.get("units");
    if (typeof raw === "number" || typeof raw === "string") {
      const parsed = parseQuantity(raw);
      if (!parsed) return null;
      const unit = typeof unitRaw === "string" && unitRaw.trim() ? unitRaw.trim().toLowerCase() : parsed.unit;
      return { value: parsed.value, unit };
    }
  }
  return null;
}

function wallTime(hour: number, minute: number, ampm: string | null) {
  if (minute > 59 || hour < 0) return null;
  let h = hour;
  if (ampm) {
    const marker = ampm.replace(/\./g, "").toLowerCase();
    if (marker !== "am" && marker !== "pm") return null;
    if (hour < 1 || hour > 12) return null;
    h = hour % 12;
    if (marker === "pm") h += 12;
  } else if (hour > 23) {
    return null;
  }
  return `${pad(h)}:${pad(minute)}`;
}

function instantFromParts(year: number, month: number, day: number, time: string | null, second: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1970 || year > 2100) return null;
  const date = `${year}-${pad(month)}-${pad(day)}`;
  const clock = time ?? "00:00";
  let result: Date;
  try {
    result = zonedDateTimeToUtc(date, clock, TIMEZONE);
  } catch {
    return null;
  }
  if (second > 0) result = new Date(result.getTime() + second * 1000);
  const parts = getZonedParts(result, TIMEZONE);
  if (parts.date !== date || parts.time !== clock) return null;
  return { date: result, dateOnly: time == null };
}

function parseClock(rest: string | undefined) {
  if (!rest) return { time: null as string | null, second: 0 };
  const match = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i.exec(rest);
  if (!match) return null;
  const second = match[3] ? Number(match[3]) : 0;
  if (second > 59) return null;
  const time = wallTime(Number(match[1]), match[2] ? Number(match[2]) : 0, match[4] ?? null);
  if (!time) return null;
  return { time, second };
}

export function parseShortcutDate(input: unknown): Date | null {
  return parseInstant(input)?.date ?? null;
}

function parseInstant(input: unknown): { date: Date; dateOnly: boolean } | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : { date: input, dateOnly: false };
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    const ms = input > 1e12 ? input : input > 1e9 ? input * 1000 : NaN;
    if (!Number.isFinite(ms)) return null;
    return { date: new Date(ms), dateOnly: false };
  }
  if (typeof input !== "string") return null;
  let text = cleanText(input).replace(/\s+(ET|EST|EDT)$/i, "");
  if (!text) return null;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const parsed = new Date(text.includes("T") ? text : text.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) return null;
    return { date: parsed, dateOnly: false };
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (iso) {
    const clock = iso[4] ? wallTime(Number(iso[4]), Number(iso[5]), null) : null;
    return instantFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), clock, iso[6] ? Number(iso[6]) : 0);
  }

  const clockTail = "(\\d{1,2}(?::\\d{2})?(?::\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)?)";
  const named = new RegExp(`^([A-Za-z]+)\\s+(\\d{1,2}),\\s*(\\d{4})(?:(?:\\s*,\\s*|\\s+at\\s+|\\s+)${clockTail})?$`, "i").exec(text);
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    if (!month) return null;
    const clock = parseClock(named[4]);
    if (clock === null) return null;
    return instantFromParts(Number(named[3]), month, Number(named[2]), clock.time, clock.second);
  }

  const numeric = new RegExp(`^(\\d{1,2})[/\\-.](\\d{1,2})[/\\-.](\\d{4})(?:(?:\\s*,\\s*|\\s+at\\s+|\\s+)${clockTail})?$`, "i").exec(text);
  if (numeric) {
    let month = Number(numeric[1]);
    let day = Number(numeric[2]);
    if (month > 12 && day <= 12) {
      month = Number(numeric[2]);
      day = Number(numeric[1]);
    }
    const clock = parseClock(numeric[4]);
    if (clock === null) return null;
    return instantFromParts(Number(numeric[3]), month, day, clock.time, clock.second);
  }

  return null;
}

function unitKind(unit: string) {
  return unit.replace(/\./g, "").replace(/\s+/g, "");
}

function asEnergy(quantity: { value: number; unit: string }) {
  const unit = unitKind(quantity.unit);
  let kcal = quantity.value;
  if (unit === "kj" || unit === "kilojoule" || unit === "kilojoules") kcal = quantity.value / 4.184;
  else if (unit && unit !== "kcal" && unit !== "cal" && unit !== "cals" && unit !== "calorie" && unit !== "calories") return null;
  if (kcal < 0 || kcal > 20000) return null;
  return Math.round(kcal * 10) / 10;
}

function asOunces(quantity: { value: number; unit: string }) {
  const unit = unitKind(quantity.unit);
  let ounces = quantity.value;
  if (unit === "ml" || unit === "milliliter" || unit === "milliliters") ounces = quantity.value / 29.5735295625;
  else if (unit === "l" || unit === "liter" || unit === "liters" || unit === "litre" || unit === "litres") ounces = quantity.value * 33.8140227018;
  else if (unit && unit !== "oz" && unit !== "floz" && unit !== "ounce" && unit !== "ounces") return null;
  if (ounces < 0 || ounces > 400) return null;
  return Math.round(ounces * 10) / 10;
}

function asPounds(quantity: { value: number; unit: string }) {
  const unit = unitKind(quantity.unit);
  let pounds = quantity.value;
  if (unit === "kg" || unit === "kilogram" || unit === "kilograms") pounds = quantity.value * 2.2046226218;
  else if (unit && unit !== "lb" && unit !== "lbs" && unit !== "pound" && unit !== "pounds") return null;
  if (pounds < 40 || pounds > 800) return null;
  return Math.round(pounds * 10) / 10;
}

function asSteps(quantity: { value: number; unit: string }) {
  const unit = unitKind(quantity.unit);
  if (unit && unit !== "count" && unit !== "counts" && unit !== "step" && unit !== "steps") return null;
  const steps = Math.round(quantity.value);
  if (steps < 0 || steps > 200000) return null;
  return steps;
}

function asMinutes(quantity: { value: number; unit: string }) {
  const unit = unitKind(quantity.unit);
  let minutes = quantity.value;
  if (!unit && quantity.value > 1440) minutes = quantity.value / 60;
  else if (unit === "s" || unit === "sec" || unit === "secs" || unit === "second" || unit === "seconds") minutes = quantity.value / 60;
  else if (unit === "h" || unit === "hr" || unit === "hrs" || unit === "hour" || unit === "hours") minutes = quantity.value * 60;
  else if (unit && unit !== "m" && unit !== "min" && unit !== "mins" && unit !== "minute" && unit !== "minutes") return null;
  if (minutes < 0 || minutes > 1440) return null;
  return Math.round(minutes * 10) / 10;
}

function asHeartRate(quantity: { value: number; unit: string }) {
  const unit = unitKind(quantity.unit);
  if (unit && unit !== "bpm" && unit !== "countmin" && unit !== "beatsmin") return null;
  if (quantity.value < 20 || quantity.value > 250) return null;
  return Math.round(quantity.value * 10) / 10;
}

function convertMetric(field: MetricField, quantity: { value: number; unit: string }) {
  if (field === "steps") return asSteps(quantity);
  if (field === "activeKcal" || field === "restingKcal") return asEnergy(quantity);
  if (field === "exerciseMinutes") return asMinutes(quantity);
  if (field === "restingHr") return asHeartRate(quantity);
  return asOunces(quantity);
}

function metricField(key: string): MetricField | null {
  for (const field of Object.keys(FIELD_KEYS) as MetricField[]) {
    if (FIELD_KEYS[field].has(key)) return field;
  }
  return null;
}

function isSample(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const bag = fields(value as Record<string, unknown>);
  return ["start", "startdate", "end", "enddate", "date", "day"].some((key) => bag.has(key));
}

function sampleDay(value: unknown, inherited: string | null, today: string) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const raw = fieldOf(value as Record<string, unknown>, ["date", "day", "start", "startdate", "end", "enddate"]);
    if (raw != null) {
      const parsed = parseShortcutDate(raw);
      if (parsed) return getZonedParts(parsed, TIMEZONE).date;
    }
  }
  return inherited ?? today;
}

function bucketFor(days: Map<string, Bucket>, date: string) {
  let bucket = days.get(date);
  if (!bucket) {
    bucket = { date, values: {}, seen: new Set(), totals: new Set() };
    days.set(date, bucket);
  }
  return bucket;
}

function putMetric(bucket: Bucket, field: MetricField, value: number, asTotal: boolean) {
  if (!asTotal && bucket.totals.has(field)) return;
  if (asTotal || !bucket.seen.has(field)) {
    bucket.values[field] = value;
    bucket.seen.add(field);
    if (asTotal) bucket.totals.add(field);
    return;
  }
  const current = bucket.values[field] ?? 0;
  bucket.values[field] = field === "steps" ? Math.round(current + value) : Math.round((current + value) * 10) / 10;
}

function absorbMetric(days: Map<string, Bucket>, field: MetricField, raw: unknown, inherited: string | null, today: string) {
  if (Array.isArray(raw)) {
    for (const item of raw) absorbMetric(days, field, item, inherited, today);
    return;
  }
  if (isSample(raw)) {
    const record = raw as Record<string, unknown>;
    const quantity = parseQuantity(fieldOf(record, ["value", "quantity", "qty", "amount"]) ?? raw);
    if (!quantity) return;
    const value = convertMetric(field, quantity);
    if (value == null) return;
    putMetric(bucketFor(days, sampleDay(record, inherited, today)), field, value, false);
    return;
  }
  const quantity = parseQuantity(raw);
  if (!quantity) return;
  const value = convertMetric(field, quantity);
  if (value == null) return;
  putMetric(bucketFor(days, inherited ?? today), field, value, true);
}

function durationMinutes(raw: unknown, start: Date, end: Date | null) {
  if (raw != null) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const bag = fields(raw as Record<string, unknown>);
      if (typeof bag.get("seconds") === "number") return asMinutes({ value: bag.get("seconds") as number, unit: "seconds" });
      if (typeof bag.get("minutes") === "number") return asMinutes({ value: bag.get("minutes") as number, unit: "minutes" });
    }
    const quantity = parseQuantity(raw);
    if (quantity) {
      const minutes = asMinutes(quantity);
      if (minutes != null) return minutes;
    }
  }
  if (end) {
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (minutes > 0 && minutes <= 1440) return minutes;
  }
  return 0;
}

function distanceLabel(raw: unknown) {
  if (typeof raw === "string" && raw.trim()) return cleanText(raw).slice(0, 40);
  const quantity = parseQuantity(raw);
  if (!quantity) return null;
  const unit = quantity.unit || "";
  const shown = Number.isInteger(quantity.value) ? String(quantity.value) : String(Math.round(quantity.value * 10) / 10);
  return `${shown}${unit ? ` ${unit}` : ""}`.slice(0, 40);
}

function absorbWorkout(raw: unknown, workouts: ParsedWorkout[]) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const record = raw as Record<string, unknown>;
  const start = parseShortcutDate(fieldOf(record, ["start", "startdate", "startedat"]));
  if (!start) return;
  const end = parseShortcutDate(fieldOf(record, ["end", "enddate", "endedat"]));
  const minutes = durationMinutes(fieldOf(record, ["duration", "durationminutes", "totalduration"]), start, end) ?? 0;
  const resolvedEnd = end && end.getTime() > start.getTime() ? end : new Date(start.getTime() + Math.max(minutes, 0) * 60000);
  const typeRaw = fieldOf(record, ["type", "workouttype", "activitytype", "activity", "name"]);
  const type = typeof typeRaw === "string" && typeRaw.trim() ? cleanText(typeRaw).slice(0, 80) : "Workout";
  const idRaw = fieldOf(record, ["id", "uuid", "identifier", "healthid"]);
  const id = typeof idRaw === "string" && idRaw.trim() ? idRaw.trim() : typeof idRaw === "number" ? String(idRaw) : "";
  const key = (id ? `id:${id}` : `span:${type.toLowerCase()}|${start.toISOString()}|${resolvedEnd.toISOString()}`).slice(0, 240);
  const caloriesRaw = parseQuantity(fieldOf(record, ["calories", "energy", "totalenergyburned", "energyburned", "activeenergy"]));
  const calories = caloriesRaw ? asEnergy(caloriesRaw) : null;
  workouts.push({
    key,
    type,
    start,
    end: resolvedEnd,
    durationMinutes: minutes,
    calories,
    distance: distanceLabel(fieldOf(record, ["distance", "totaldistance"])),
  });
}

function sleepKind(raw: unknown): "asleep" | "inbed" | "awake" | null {
  if (typeof raw !== "string" || !raw.trim()) return "asleep";
  const text = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (text.includes("awake")) return "awake";
  if (text.includes("inbed")) return "inbed";
  if (text.includes("asleep") || text.includes("core") || text.includes("rem") || text.includes("deep")) return "asleep";
  return null;
}

type SleepSegment = { kind: "asleep" | "inbed"; start: Date; end: Date };

function absorbSleep(raw: unknown, segments: SleepSegment[]) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const record = raw as Record<string, unknown>;
  const start = parseShortcutDate(fieldOf(record, ["start", "startdate"]));
  const end = parseShortcutDate(fieldOf(record, ["end", "enddate"]));
  if (!start || !end || end.getTime() <= start.getTime()) return;
  const kind = sleepKind(fieldOf(record, ["state", "value", "category", "sleepstate", "categoryvalue", "analysis"]));
  if (kind !== "asleep" && kind !== "inbed") return;
  segments.push({ kind, start, end });
}

function unionRange(ranges: { start: Date; end: Date }[]) {
  const sorted = ranges
    .filter((range) => range.end.getTime() > range.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (!sorted.length) return null;
  let cursor = sorted[0].start.getTime();
  let end = sorted[0].end.getTime();
  let total = 0;
  let minStart = cursor;
  let maxEnd = end;
  for (const range of sorted) {
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();
    minStart = Math.min(minStart, startMs);
    maxEnd = Math.max(maxEnd, endMs);
    if (startMs > end) {
      total += end - cursor;
      cursor = startMs;
      end = endMs;
    } else {
      end = Math.max(end, endMs);
    }
  }
  total += end - cursor;
  const minutes = Math.round(total / 60000);
  if (minutes < 1) return null;
  return {
    bedtime: new Date(minStart),
    wakeAt: new Date(maxEnd),
    durationMinutes: Math.min(960, minutes),
  };
}

export function collapseSleep(segments: SleepSegment[]): ParsedNight[] {
  const groups = new Map<string, SleepSegment[]>();
  for (const segment of segments) {
    const wakeDate = getZonedParts(segment.end, TIMEZONE).date;
    const list = groups.get(wakeDate) ?? [];
    list.push(segment);
    groups.set(wakeDate, list);
  }
  const nights: ParsedNight[] = [];
  for (const [wakeDate, list] of groups) {
    const asleep = list.filter((segment) => segment.kind === "asleep");
    const chosen = asleep.length ? asleep : list.filter((segment) => segment.kind === "inbed");
    const span = unionRange(chosen);
    if (!span) continue;
    nights.push({ wakeDate, ...span });
  }
  return nights.sort((a, b) => a.wakeDate.localeCompare(b.wakeDate));
}

function absorbWeight(raw: unknown, inherited: string | null, today: string, weights: ParsedWeight[]) {
  if (Array.isArray(raw)) {
    for (const item of raw) absorbWeight(item, inherited, today, weights);
    return;
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const quantity = parseQuantity(fieldOf(record, ["weight", "bodymass", "value", "quantity", "pounds", "lb"]) ?? raw);
    const pounds = quantity ? asPounds(quantity) : null;
    if (pounds == null) return;
    const stamp = fieldOf(record, ["date", "day", "start", "startdate", "measuredat", "time"]);
    const instant = stamp == null ? null : parseInstant(stamp);
    const measuredAt = instant ? (instant.dateOnly ? noon(getZonedParts(instant.date).date) : instant.date) : noon(inherited ?? today);
    weights.push({ measuredAt, pounds });
    return;
  }
  const quantity = parseQuantity(raw);
  const pounds = quantity ? asPounds(quantity) : null;
  if (pounds == null) return;
  weights.push({ measuredAt: noon(inherited ?? today), pounds });
}

function noon(date: string) {
  return zonedDateTimeToUtc(date, "12:00", TIMEZONE);
}

function recordDate(record: Record<string, unknown>) {
  const raw = fieldOf(record, ["date", "day"]);
  if (raw == null) return null;
  const parsed = parseShortcutDate(raw);
  return parsed ? getZonedParts(parsed, TIMEZONE).date : null;
}

function absorbRecord(raw: unknown, inherited: string | null, state: ParseState) {
  if (Array.isArray(raw)) {
    for (const item of raw) absorbRecord(item, inherited, state);
    return;
  }
  if (!raw || typeof raw !== "object") return;
  const record = raw as Record<string, unknown>;
  const date = recordDate(record) ?? inherited;
  for (const [key, value] of Object.entries(record)) {
    const name = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (DATE_KEYS.has(name)) continue;
    if (DAY_LIST_KEYS.has(name)) {
      absorbRecord(value, date, state);
      continue;
    }
    if (WORKOUT_KEYS.has(name)) {
      const list = Array.isArray(value) ? value : [value];
      for (const item of list) absorbWorkout(item, state.workouts);
      continue;
    }
    if (SLEEP_KEYS.has(name)) {
      const list = Array.isArray(value) ? value : [value];
      for (const item of list) absorbSleep(item, state.segments);
      continue;
    }
    if (WEIGHT_LIST_KEYS.has(name)) {
      absorbWeight(value, date, state.today, state.weights);
      continue;
    }
    if (WEIGHT_KEYS.has(name)) {
      absorbWeight(value, date, state.today, state.weights);
      continue;
    }
    const field = metricField(name);
    if (field) absorbMetric(state.days, field, value, date, state.today);
  }
}

type ParseState = {
  today: string;
  days: Map<string, Bucket>;
  workouts: ParsedWorkout[];
  segments: SleepSegment[];
  weights: ParsedWeight[];
};

function unwrap(input: unknown) {
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as unknown;
    } catch {
      return input;
    }
  }
  return input;
}

function finishDay(bucket: Bucket): HealthDayMetrics {
  return {
    date: bucket.date,
    steps: bucket.seen.has("steps") ? (bucket.values.steps ?? null) : null,
    activeKcal: bucket.seen.has("activeKcal") ? (bucket.values.activeKcal ?? null) : null,
    restingKcal: bucket.seen.has("restingKcal") ? (bucket.values.restingKcal ?? null) : null,
    exerciseMinutes: bucket.seen.has("exerciseMinutes") ? (bucket.values.exerciseMinutes ?? null) : null,
    restingHr: bucket.seen.has("restingHr") ? (bucket.values.restingHr ?? null) : null,
    dietaryWaterOz: bucket.seen.has("dietaryWaterOz") ? (bucket.values.dietaryWaterOz ?? null) : null,
    present: {
      steps: bucket.seen.has("steps"),
      activeKcal: bucket.seen.has("activeKcal"),
      restingKcal: bucket.seen.has("restingKcal"),
      exerciseMinutes: bucket.seen.has("exerciseMinutes"),
      restingHr: bucket.seen.has("restingHr"),
      dietaryWaterOz: bucket.seen.has("dietaryWaterOz"),
    },
  };
}

export function parseHealthPayload(input: unknown, now = new Date()): ParsedHealth {
  const state: ParseState = {
    today: todayDateString(now),
    days: new Map(),
    workouts: [],
    segments: [],
    weights: [],
  };
  absorbRecord(unwrap(input), null, state);
  const workouts = new Map<string, ParsedWorkout>();
  for (const workout of state.workouts) workouts.set(workout.key, workout);
  const weights = new Map<number, ParsedWeight>();
  for (const weight of state.weights) weights.set(weight.measuredAt.getTime(), weight);
  return {
    days: [...state.days.values()].map(finishDay).sort((a, b) => a.date.localeCompare(b.date)),
    workouts: [...workouts.values()],
    nights: collapseSleep(state.segments),
    weights: [...weights.values()].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime()),
  };
}
