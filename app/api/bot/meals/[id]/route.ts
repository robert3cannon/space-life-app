import { getMealById, patchMeal, removeMeal } from "@/lib/handlers/meals";
import { withBot } from "@/lib/api";

export const GET = withBot(getMealById);
export const PATCH = withBot(patchMeal);
export const DELETE = withBot(removeMeal);

export const dynamic = "force-dynamic";
