import { getHabit, patchHabit, removeHabit } from "@/lib/handlers/habits";
import { withBot } from "@/lib/api";

export const GET = withBot(getHabit);
export const PATCH = withBot(patchHabit);
export const DELETE = withBot(removeHabit);
export const dynamic = "force-dynamic";
