import { getWorkouts, postWorkout } from "@/lib/handlers/workouts";
import { withBot } from "@/lib/api";

export const GET = withBot(getWorkouts);
export const POST = withBot(postWorkout);

export const dynamic = "force-dynamic";
