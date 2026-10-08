import { withUser } from "@/lib/api";
import { postWorkoutExercise } from "@/lib/handlers/workouts";

export const POST = withUser(postWorkoutExercise);

export const dynamic = "force-dynamic";
