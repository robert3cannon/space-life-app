import { getMeals, postMeal } from "@/lib/handlers/meals";
import { withUser } from "@/lib/api";

export const GET = withUser(getMeals);
export const POST = withUser(postMeal);

export const dynamic = "force-dynamic";
