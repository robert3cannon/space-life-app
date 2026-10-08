import { addCalendarDays, calendarWeekday } from "./time";

/** Empty or a full week means every day. Otherwise Sunday is 0, matching `calendarWeekday`. */
export function scheduledDays(days: number[] | null | undefined) {
  if (!days || days.length === 0) return null;
  const unique = [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
  if (unique.length === 0 || unique.length === 7) return null;
  return unique;
}

export function isScheduled(days: number[] | null | undefined, date: string) {
  const scheduled = scheduledDays(days);
  if (!scheduled) return true;
  return scheduled.includes(calendarWeekday(date));
}

/**
 * Current streak counts scheduled days completed through today.
 * An unfinished today does not break it. Days off the schedule are skipped.
 * Best is the longest completed run inside `from`…`today`.
 */
export function habitStreaks(input: {
  days: number[] | null | undefined;
  checked: ReadonlySet<string>;
  today: string;
  from: string;
}) {
  const { days, checked, today, from } = input;
  let best = 0;
  let run = 0;
  for (let date = from; date <= today; date = addCalendarDays(date, 1)) {
    if (!isScheduled(days, date)) continue;
    if (date === today && !checked.has(date)) continue;
    if (checked.has(date)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  let cursor = today;
  if (isScheduled(days, today) && !checked.has(today)) cursor = addCalendarDays(today, -1);
  let current = 0;
  while (cursor >= from) {
    if (!isScheduled(days, cursor)) {
      cursor = addCalendarDays(cursor, -1);
      continue;
    }
    if (!checked.has(cursor)) break;
    current += 1;
    cursor = addCalendarDays(cursor, -1);
  }
  if (current > best) best = current;
  return { current, best };
}
