import { getWorkoutById, patchWorkout, removeWorkout } from "@/lib/handlers/workouts";
import { withBot } from "@/lib/api";

export const GET = withBot(getWorkoutById);
export const PATCH = withBot(patchWorkout);
export const DELETE = withBot(removeWorkout);

export const dynamic = "force-dynamic";
