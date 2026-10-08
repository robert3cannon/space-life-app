import { getFoodById, patchFood, removeFood } from "@/lib/handlers/food";
import { withBot } from "@/lib/api";

export const GET = withBot(getFoodById);
export const PATCH = withBot(patchFood);
export const DELETE = withBot(removeFood);

export const dynamic = "force-dynamic";
