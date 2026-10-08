import { getFoodById, patchFood, removeFood } from "@/lib/handlers/food";
import { withUser } from "@/lib/api";

export const GET = withUser(getFoodById);
export const PATCH = withUser(patchFood);
export const DELETE = withUser(removeFood);

export const dynamic = "force-dynamic";
