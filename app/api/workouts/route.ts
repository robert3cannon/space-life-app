import { getWorkouts, postWorkout } from "@/lib/handlers/workouts";
import { withUser } from "@/lib/api";

export const GET = withUser(getWorkouts);
export const POST = withUser(postWorkout);

export const dynamic = "force-dynamic";
