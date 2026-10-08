import { postHabitCheck } from "@/lib/handlers/habits";
import { withBot } from "@/lib/api";

export const POST = withBot(postHabitCheck);
export const dynamic = "force-dynamic";
