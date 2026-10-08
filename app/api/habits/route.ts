import { getHabits, postHabit } from "@/lib/handlers/habits";
import { withUser } from "@/lib/api";

export const GET = withUser(getHabits);
export const POST = withUser(postHabit);
export const dynamic = "force-dynamic";
