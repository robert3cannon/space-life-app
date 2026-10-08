import { withUser } from "@/lib/api";
import { getExercises } from "@/lib/handlers/exercises";

export const GET = withUser(getExercises);

export const dynamic = "force-dynamic";
