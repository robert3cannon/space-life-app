import { patchMealItem, removeMealItem } from "@/lib/handlers/meals";
import { withBot } from "@/lib/api";

export const PATCH = withBot(patchMealItem);
export const DELETE = withBot(removeMealItem);

export const dynamic = "force-dynamic";
