import { withUser } from "@/lib/api";
import { getExerciseById } from "@/lib/handlers/exercises";

export const GET = withUser(getExerciseById);

export const dynamic = "force-dynamic";
