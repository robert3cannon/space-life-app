import { getEvents, postEvent } from "@/lib/handlers/events";
import { withUser } from "@/lib/api";

export const GET = withUser(getEvents);
export const POST = withUser(postEvent);

export const dynamic = "force-dynamic";
