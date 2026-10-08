import { getHabits, postHabit } from "@/lib/handlers/habits";
import { withBot } from "@/lib/api";

export const GET = withBot(getHabits);
export const POST = withBot(postHabit);
export const dynamic = "force-dynamic";
