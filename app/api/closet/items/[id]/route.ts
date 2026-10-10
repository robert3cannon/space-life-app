import { withUser } from "@/lib/api";
import { deleteClosetItem, patchClosetItem } from "@/lib/handlers/closet";

export const PATCH = withUser(patchClosetItem);
export const DELETE = withUser(deleteClosetItem);
export const dynamic = "force-dynamic";
