import { getMeals, postMeal } from "@/lib/handlers/meals";
import { withBot } from "@/lib/api";

export const GET = withBot(getMeals);
export const POST = withBot(postMeal);

export const dynamic = "force-dynamic";
