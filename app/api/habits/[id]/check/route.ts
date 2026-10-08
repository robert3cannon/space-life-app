import { postHabitCheck } from "@/lib/handlers/habits";
import { withUser } from "@/lib/api";

export const POST = withUser(postHabitCheck);
export const dynamic = "force-dynamic";
