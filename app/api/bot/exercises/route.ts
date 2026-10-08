import { withBot } from "@/lib/api";
import { getBotExercises } from "@/lib/handlers/exercises";

export const GET = withBot(getBotExercises);

export const dynamic = "force-dynamic";
