import { getEventById, patchEvent, removeEvent } from "@/lib/handlers/events";
import { withBot } from "@/lib/api";

export const GET = withBot(getEventById);
export const PATCH = withBot(patchEvent);
export const DELETE = withBot(removeEvent);

export const dynamic = "force-dynamic";
