import { getEventById, patchEvent, removeEvent } from "@/lib/handlers/events";
import { withUser } from "@/lib/api";

export const GET = withUser(getEventById);
export const PATCH = withUser(patchEvent);
export const DELETE = withUser(removeEvent);

export const dynamic = "force-dynamic";
