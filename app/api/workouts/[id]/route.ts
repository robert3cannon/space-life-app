import { getWorkoutById, patchWorkout, removeWorkout } from "@/lib/handlers/workouts";
import { withUser } from "@/lib/api";

export const GET = withUser(getWorkoutById);
export const PATCH = withUser(patchWorkout);
export const DELETE = withUser(removeWorkout);

export const dynamic = "force-dynamic";
