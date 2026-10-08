export const TIMEZONE = "America/Detroit";
export const HOME_LABEL = "East Lansing";
export const COOKIE_NAME = "orbit_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60;

export const EVENT_META = {
  class: { label: "Class" },
  work: { label: "Work" },
  study: { label: "Study" },
  workout: { label: "Workout" },
  meal: { label: "Meal" },
  other: { label: "Other" },
} as const;

export const MEAL_META = {
  breakfast: { label: "Breakfast" },
  lunch: { label: "Lunch" },
  dinner: { label: "Dinner" },
  snack: { label: "Snack" },
} as const;
