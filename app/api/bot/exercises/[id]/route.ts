import { withBot } from "@/lib/api";
import { getExerciseById } from "@/lib/handlers/exercises";

export const GET = withBot(getExerciseById);

export const dynamic = "force-dynamic";
