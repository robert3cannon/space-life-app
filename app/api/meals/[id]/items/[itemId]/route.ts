import { patchMealItem, removeMealItem } from "@/lib/handlers/meals";
import { withUser } from "@/lib/api";

export const PATCH = withUser(patchMealItem);
export const DELETE = withUser(removeMealItem);

export const dynamic = "force-dynamic";
