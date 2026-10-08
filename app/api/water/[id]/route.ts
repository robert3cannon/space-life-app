import { removeWater } from "@/lib/handlers/water";
import { withUser } from "@/lib/api";

export const DELETE = withUser(removeWater);
export const dynamic = "force-dynamic";
