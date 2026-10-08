import { getHabit, patchHabit, removeHabit } from "@/lib/handlers/habits";
import { withUser } from "@/lib/api";

export const GET = withUser(getHabit);
export const PATCH = withUser(patchHabit);
export const DELETE = withUser(removeHabit);
export const dynamic = "force-dynamic";
