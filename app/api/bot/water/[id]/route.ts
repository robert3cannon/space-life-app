import { removeWater } from "@/lib/handlers/water";
import { withBot } from "@/lib/api";

export const DELETE = withBot(removeWater);
export const dynamic = "force-dynamic";
