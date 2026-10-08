import { HttpError } from "./errors";
import { addCalendarDays, zonedDateTimeToUtc } from "./time";

const MAX_MINUTES = 16 * 60;

export type SleepWindow = {
  wakeDate: string;
  bedtime: Date | null;
  wakeAt: Date | null;
  durationMinutes: number;
};

/**
 * A sleep session belongs to the morning you woke up.
 * Bedtime 1:30 AM and wake 11:00 AM are the same Detroit date.
 * Bedtime 11:30 PM is the previous evening when wake is 11:00 AM.
 */
export function resolveSleepWindow(input: {
  wakeDate: string;
  bedtime?: string | null;
  bedtimeDate?: string | null;
  wakeTime?: string | null;
  durationMinutes?: number | null;
}): SleepWindow {
  const bedtime = input.bedtime || null;
  const wakeTime = input.wakeTime || null;
  if (bedtime && wakeTime) {
    const bedtimeDate =
      input.bedtimeDate ||
      (bedtime >= wakeTime ? addCalendarDays(input.wakeDate, -1) : input.wakeDate);
    const bedtimeAt = zonedDateTimeToUtc(bedtimeDate, bedtime);
    const wakeAt = zonedDateTimeToUtc(input.wakeDate, wakeTime);
    const durationMinutes = Math.round((wakeAt.getTime() - bedtimeAt.getTime()) / 60000);
    if (durationMinutes < 1 || durationMinutes > MAX_MINUTES) {
      throw new HttpError("That bedtime and wake time don't make a night of sleep", 400);
    }
    return { wakeDate: input.wakeDate, bedtime: bedtimeAt, wakeAt, durationMinutes };
  }
  const duration = input.durationMinutes;
  if (duration == null || !Number.isInteger(duration) || duration < 1 || duration > MAX_MINUTES) {
    throw new HttpError("Provide bedtime and wake time, or a duration up to 16 hours", 400);
  }
  return { wakeDate: input.wakeDate, bedtime: null, wakeAt: null, durationMinutes: duration };
}
