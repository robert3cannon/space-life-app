import { withBot } from "@/lib/api";
import { postWorkoutExercise } from "@/lib/handlers/workouts";

export const POST = withBot(postWorkoutExercise);

export const dynamic = "force-dynamic";
