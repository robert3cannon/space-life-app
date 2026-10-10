import { withUser } from "@/lib/api";
import { patchCategory, removeCategory } from "@/lib/handlers/closet";

export const PATCH = withUser(patchCategory);
export const DELETE = withUser(removeCategory);
export const dynamic = "force-dynamic";
