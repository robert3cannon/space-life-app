import { withBot } from "@/lib/api";
import { patchClosetItem } from "@/lib/handlers/closet";

export const PATCH = withBot(patchClosetItem);
export const dynamic = "force-dynamic";
