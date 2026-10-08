import { TIMEZONE } from "./constants";
import { DEFAULT_EQUIPMENT } from "./equipment";
import type { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  timezone: TIMEZONE,
  targets: {
    calories: 2400,
    proteinG: 150,
    carbsG: 280,
    fatG: 75,
  },
  mealReminders: [
    { id: "breakfast", label: "Breakfast", time: "11:30", enabled: true },
    { id: "lunch", label: "Lunch", time: "15:00", enabled: true },
    { id: "dinner", label: "Dinner", time: "20:00", enabled: true },
  ],
  defaultEventReminderMinutes: 30,
  defaultWorkoutReminderMinutes: 30,
  waterGoalOz: 100,
  waterReminders: { enabled: false, times: ["12:00", "16:00", "20:00"] },
  sleepReminder: { enabled: false, time: "01:00" },
  habitReminder: { enabled: false, time: "22:00" },
  equipment: DEFAULT_EQUIPMENT,
  circuitAudio: { enabled: true, volume: 70 },
};
