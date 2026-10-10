import { TIMEZONE } from "./constants";
import { getZonedParts, zonedDateTimeToUtc } from "./time";

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTimeRange(startsAt: string, endsAt: string) {
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

export function formatLongDate(dateStr: string) {
  const date = zonedDateTimeToUtc(dateStr, "12:00");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatWeekday(dateStr: string) {
  const date = zonedDateTimeToUtc(dateStr, "12:00");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(date);
}

export function formatMonthDay(dateStr: string) {
  const date = zonedDateTimeToUtc(dateStr, "12:00");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(date);
}

export function dayNumber(dateStr: string) {
  return Number(dateStr.slice(8, 10));
}

export function eventDay(iso: string) {
  return getZonedParts(new Date(iso)).date;
}

export function formatWhen(iso: string) {
  const date = eventDay(iso);
  return `${formatWeekday(date)} ${formatTime(iso)}`;
}

export function formatAgo(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function formatDelta(from: Date, to: Date) {
  const minutes = Math.round((to.getTime() - from.getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours < 24) return remain ? `in ${hours}h ${remain}m` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export function formatWeight(weight: number | null, unit: string) {
  if (weight == null) return "";
  const shown = Number.isInteger(weight) ? String(weight) : String(Math.round(weight * 10) / 10);
  return `${shown} ${unit}`;
}

export function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours <= 0) return `${remain}m`;
  if (remain === 0) return `${hours}h`;
  return `${hours}h ${remain}m`;
}

export function formatExerciseLog(
  name: string,
  sets: Array<{ reps: number | null; weight: number | null; weightUnit: string; durationSeconds: number | null }>,
) {
  if (!sets.length) return name;
  const dose = (set: (typeof sets)[number]) =>
    set.durationSeconds != null && set.reps == null ? formatDuration(set.durationSeconds) : set.reps != null ? String(set.reps) : "";
  const load = (set: (typeof sets)[number]) => (set.weight == null ? "bodyweight" : formatWeight(set.weight, set.weightUnit));
  const first = sets[0];
  const same = sets.every(
    (set) =>
      set.reps === first.reps &&
      set.weight === first.weight &&
      set.durationSeconds === first.durationSeconds &&
      set.weightUnit === first.weightUnit,
  );
  if (same) {
    return `${name} · ${[String(sets.length), dose(first), load(first)].filter(Boolean).join(" × ")}`;
  }
  const parts = sets.map((set) => [dose(set), load(set)].filter(Boolean).join(" × "));
  return `${name} · ${parts.join(", ")}`;
}

export function formatDuration(seconds: number | null) {
  if (seconds == null) return "";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return remain ? `${minutes}m ${remain}s` : `${minutes}m`;
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}
