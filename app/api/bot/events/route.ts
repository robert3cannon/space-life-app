import { getEvents, postEvent } from "@/lib/handlers/events";
import { withBot } from "@/lib/api";

export const GET = withBot(getEvents);
export const POST = withBot(postEvent);

export const dynamic = "force-dynamic";
