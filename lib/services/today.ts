import { HOME_LABEL, TIMEZONE } from "../constants";
import { formatDelta, formatTimeRange, formatWhen } from "../format";
import { displayName, greetingFor } from "../profile";
import { addCalendarDays, getZonedParts, todayDateString, zonedDateTimeToUtc, zonedDayRange } from "../time";
import type { TodayPayload } from "../types";
import { listActivity } from "./activity";
import { listEvents, nextEvent } from "./events";
import { listFood, sumFood } from "./food";
import { habitsDue } from "./habits";
import { upcomingReminders } from "./reminders";
import { getSleep } from "./sleep";
import { getSettings } from "./settings";
import { getWaterDay } from "./water";
import { nextPlannedWorkout, workoutsOnDay } from "./workouts";

export async function getToday(now = new Date()): Promise<TodayPayload> {
  const date = todayDateString(now);
  const day = zonedDayRange(date);
  const horizon = zonedDateTimeToUtc(addCalendarDays(date, 8), "00:00");
  const [prefs, events, focusEvent, logs, workouts, nextWorkout, reminders, activity, water, sleep, habits] = await Promise.all([
    getSettings(),
    listEvents(day.from, day.to),
    nextEvent(now, horizon),
    listFood(day.from, day.to),
    workoutsOnDay(day.from, day.to),
    nextPlannedWorkout(now),
    upcomingReminders(4),
    listActivity(4),
    getWaterDay(date),
    getSleep(date),
    habitsDue(date),
  ]);

  let focus: TodayPayload["focus"] = null;
  if (focusEvent) {
    const starts = new Date(focusEvent.startsAt);
    const when = formatTimeRange(focusEvent.startsAt, focusEvent.endsAt);
    const place = focusEvent.location ? `${when} · ${focusEvent.location}` : when;
    if (starts.getTime() <= now.getTime()) {
      focus = { label: "Now", title: focusEvent.title, detail: place, eventId: focusEvent.id };
    } else if (getZonedParts(starts).date === date) {
      focus = {
        label: "Up next",
        title: focusEvent.title,
        detail: `${formatDelta(now, starts)} · ${place}`,
        eventId: focusEvent.id,
      };
    } else {
      focus = {
        label: "Coming up",
        title: focusEvent.title,
        detail: `${formatWhen(focusEvent.startsAt)} · ${place}`,
        eventId: focusEvent.id,
      };
    }
  }

  return {
    timezone: TIMEZONE,
    now: now.toISOString(),
    date,
    greeting: greetingFor(getZonedParts(now).hour, displayName()),
    place: `${HOME_LABEL} · ET`,
    events,
    focus,
    food: {
      targets: prefs.targets,
      totals: sumFood(logs),
      logs,
    },
    workouts,
    nextWorkout,
    reminders,
    activity,
    water: { goalOz: water.goalOz, totalOz: water.totalOz },
    sleep: {
      log: sleep.log,
      weekAverageMinutes: sleep.week.averageMinutes,
      trendMinutes: sleep.week.trendMinutes,
    },
    habits,
  };
}
