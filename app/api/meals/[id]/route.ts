import { getMealById, patchMeal, removeMeal } from "@/lib/handlers/meals";
import { withUser } from "@/lib/api";

export const GET = withUser(getMealById);
export const PATCH = withUser(patchMeal);
export const DELETE = withUser(removeMeal);

export const dynamic = "force-dynamic";
